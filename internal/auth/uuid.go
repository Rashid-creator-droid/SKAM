package auth

import (
	"errors"

	"github.com/google/uuid"
)

func parseUUID(s string) (uuid.UUID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, errors.New("invalid uuid")
	}
	return id, nil
}

