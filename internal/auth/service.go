package auth

import (
	"context"
	"errors"
	"strings"

	"SKAM/internal/user"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailTaken         = errors.New("email already taken")
)

type Service struct {
	db *gorm.DB
	tm *TokenManager
}

func NewService(db *gorm.DB, tm *TokenManager) *Service {
	return &Service{db: db, tm: tm}
}

func (s *Service) Register(ctx context.Context, email, password string) (user.User, string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || password == "" {
		return user.User{}, "", errors.New("email and password required")
	}

	var existing user.User
	err := s.db.WithContext(ctx).Where("email = ?", email).First(&existing).Error
	if err == nil {
		return user.User{}, "", ErrEmailTaken
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return user.User{}, "", err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return user.User{}, "", err
	}

	u := user.User{
		Email:        email,
		PasswordHash: string(hash),
	}
	if err := s.db.WithContext(ctx).Create(&u).Error; err != nil {
		return user.User{}, "", err
	}

	token, err := s.tm.Issue(u.ID, u.Email)
	if err != nil {
		return user.User{}, "", err
	}

	return u, token, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (user.User, string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || password == "" {
		return user.User{}, "", ErrInvalidCredentials
	}

	var u user.User
	if err := s.db.WithContext(ctx).Where("email = ?", email).First(&u).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return user.User{}, "", ErrInvalidCredentials
		}
		return user.User{}, "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return user.User{}, "", ErrInvalidCredentials
	}

	token, err := s.tm.Issue(u.ID, u.Email)
	if err != nil {
		return user.User{}, "", err
	}

	return u, token, nil
}
