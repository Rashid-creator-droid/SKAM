package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type QRHandler struct {
	qr *QRService
}

func NewQRHandler(qr *QRService) *QRHandler {
	return &QRHandler{qr: qr}
}

type qrCreateResponse struct {
	Token     string `json:"token"`
	ExpiresIn int    `json:"expires_in"`
}

func (h *QRHandler) Create(c *gin.Context) {
	token, expiresIn, err := h.qr.Create(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, qrCreateResponse{Token: token, ExpiresIn: expiresIn})
}

type qrConfirmRequest struct {
	Token string `json:"token" binding:"required"`
}

func (h *QRHandler) Confirm(c *gin.Context) {
	var req qrConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claims := GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid, err := parseUUID(claims.Subject)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.qr.Confirm(c.Request.Context(), req.Token, uid, claims.Email); err != nil {
		if errors.Is(err, ErrQRNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "qr token not found"})
			return
		}
		if errors.Is(err, ErrQRAlreadyUsed) {
			c.JSON(http.StatusConflict, gin.H{"error": "qr token already used"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *QRHandler) Status(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}

	st, err := h.qr.Status(c.Request.Context(), token)
	if err != nil {
		if errors.Is(err, ErrQRNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "qr token not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if st.Status != "confirmed" {
		c.JSON(http.StatusOK, gin.H{"status": st.Status})
		return
	}

	// One-time handoff: return JWT and mark token as used.
	consumed, err := h.qr.ConsumeConfirmed(c.Request.Context(), token)
	if err != nil {
		if errors.Is(err, ErrQRNotReady) {
			c.JSON(http.StatusOK, gin.H{"status": "pending"})
			return
		}
		if errors.Is(err, ErrQRAlreadyUsed) {
			c.JSON(http.StatusOK, gin.H{"status": "used"})
			return
		}
		if errors.Is(err, ErrQRNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "qr token not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "confirmed",
		"token":  consumed.Token,
		"user": gin.H{
			"id":    consumed.UserID,
			"email": consumed.Email,
		},
	})
}
