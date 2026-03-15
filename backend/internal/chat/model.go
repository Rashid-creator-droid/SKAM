package chat

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Message struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey"`
	GroupID   *uuid.UUID `gorm:"type:uuid;index"`
	UserID    uuid.UUID  `gorm:"type:uuid;index;not null"`
	UserEmail string     `gorm:"not null"`
	Text      string     `gorm:"type:text;not null"`
	CreatedAt time.Time
}

func (m *Message) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
