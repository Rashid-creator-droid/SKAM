package user

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey"`
	Email        string    `gorm:"unique;not null"`
	PasswordHash string    `gorm:"not null"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	u.Email = strings.TrimSpace(strings.ToLower(u.Email))
	return nil
}

func (u *User) BeforeSave(tx *gorm.DB) error {
	u.Email = strings.TrimSpace(strings.ToLower(u.Email))
	return nil
}
