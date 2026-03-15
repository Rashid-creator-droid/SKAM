package user

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

var ErrUserNotFound = errors.New("пользователь не найден")

func (s *Service) GetByEmail(email string) (*User, error) {
	var user User
	result := s.db.Where("email = ?", email).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

func (s *Service) GetByID(id uuid.UUID) (*User, error) {
	var user User
	result := s.db.First(&user, "id = ?", id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

type UserDTO struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func toDTO(u *User) UserDTO {
	return UserDTO{
		ID:    u.ID.String(),
		Email: u.Email,
	}
}
