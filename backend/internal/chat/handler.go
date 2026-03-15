package chat

import (
	"net/http"
	"time"

	"SKAM/internal/auth"
	"SKAM/internal/group"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

type sendMessageRequest struct {
	Text    string `json:"text" binding:"required"`
	GroupID string `json:"group_id"`
}

type messageDTO struct {
	ID        string     `json:"id"`
	GroupID   *string    `json:"group_id"`
	UserID    string     `json:"user_id"`
	UserEmail string     `json:"user_email"`
	Text      string     `json:"text"`
	CreatedAt time.Time  `json:"created_at"`
}

func toDTO(m Message) messageDTO {
	var groupID *string
	if m.GroupID != nil {
		gid := m.GroupID.String()
		groupID = &gid
	}
	return messageDTO{
		ID:        m.ID.String(),
		GroupID:   groupID,
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

	var groupID *uuid.UUID
	if req.GroupID != "" {
		gid, err := uuid.Parse(req.GroupID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
			return
		}
		groupID = &gid
	}

	msg, err := h.svc.CreateMessage(c.Request.Context(), groupID, uid, claims.Email, req.Text)
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

	var groupID *uuid.UUID
	if gid := c.Query("group_id"); gid != "" {
		id, err := uuid.Parse(gid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
			return
		}
		groupID = &id
	}

	var sincePtr *time.Time
	if s := c.Query("since"); s != "" {
		t, err := time.Parse(time.RFC3339Nano, s)
		if err == nil {
			sincePtr = &t
		}
	}

	msgs, err := h.svc.ListMessages(c.Request.Context(), groupID, sincePtr, 100)
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

func (h *Handler) DeleteMessage(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
		return
	}

	actorID, _ := uuid.Parse(claims.Subject)

	msg, err := h.svc.GetMessage(c.Request.Context(), messageID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "сообщение не найдено"})
		return
	}

	canDelete := msg.UserID == actorID

	if msg.GroupID != nil && !canDelete {
		isModOrAdmin, err := checkModeratorOrAdmin(h.svc.db, *msg.GroupID, actorID)
		if err == nil && isModOrAdmin {
			canDelete = true
		}
	}

	if !canDelete {
		c.JSON(http.StatusForbidden, gin.H{"error": "недостаточно прав для удаления сообщения"})
		return
	}

	if err := h.svc.DeleteMessage(c.Request.Context(), messageID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "сообщение удалено"})
}

func checkModeratorOrAdmin(db *gorm.DB, groupID, userID uuid.UUID) (bool, error) {
	var count int64
	err := db.Model(&struct{}{}).
		Table("group_members").
		Where("group_id = ? AND user_id = ? AND role IN (?, ?)", groupID, userID, group.RoleModerator, group.RoleAdmin).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
