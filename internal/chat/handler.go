package chat

import (
	"net/http"
	"time"

	"SKAM/internal/auth"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

type sendMessageRequest struct {
	Text string `json:"text" binding:"required"`
}

type messageDTO struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	UserEmail string    `json:"user_email"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

func toDTO(m Message) messageDTO {
	return messageDTO{
		ID:        m.ID.String(),
		UserID:    m.UserID.String(),
		UserEmail: m.UserEmail,
		Text:      m.Text,
		CreatedAt: m.CreatedAt,
	}
}

func (h *Handler) Send(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req sendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uid, err := uuid.Parse(claims.Subject)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}

	msg, err := h.svc.CreateMessage(c.Request.Context(), uid, claims.Email, req.Text)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, toDTO(msg))
}

func (h *Handler) List(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var sincePtr *time.Time
	if s := c.Query("since"); s != "" {
		t, err := time.Parse(time.RFC3339Nano, s)
		if err == nil {
			sincePtr = &t
		}
	}

	msgs, err := h.svc.ListMessages(c.Request.Context(), sincePtr, 100)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	out := make([]messageDTO, 0, len(msgs))
	for _, m := range msgs {
		out = append(out, toDTO(m))
	}
	c.JSON(http.StatusOK, out)
}

