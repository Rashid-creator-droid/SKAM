package chat

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

var ErrEmptyText = errors.New("message text is empty")

func (s *Service) CreateMessage(ctx context.Context, userID uuid.UUID, email, text string) (Message, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return Message{}, ErrEmptyText
	}

	msg := Message{
		UserID:    userID,
		UserEmail: email,
		Text:      text,
	}
	if err := s.db.WithContext(ctx).Create(&msg).Error; err != nil {
		return Message{}, err
	}
	return msg, nil
}

func (s *Service) ListMessages(ctx context.Context, since *time.Time, limit int) ([]Message, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var msgs []Message
	q := s.db.WithContext(ctx).Order("created_at asc").Limit(limit)
	if since != nil {
		q = q.Where("created_at > ?", *since)
	}
	if err := q.Find(&msgs).Error; err != nil {
		return nil, err
	}
	return msgs, nil
}

