package group

import (
	"net/http"
	"time"

	"SKAM/internal/auth"
	"SKAM/internal/user"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

type createGroupRequest struct {
	Name        string `json:"name" binding:"required,max=255"`
	Description string `json:"description" max:"1024"`
}

type groupDTO struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Description string  `json:"description"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

func toGroupDTO(g *Group) groupDTO {
	return groupDTO{
		ID:          g.ID.String(),
		Name:        g.Name,
		Description: g.Description,
		CreatedBy:   g.CreatedBy.String(),
		CreatedAt:   g.CreatedAt,
	}
}

type groupWithRoleDTO struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	UserRole Role   `json:"user_role"`
}

func toGroupWithRoleDTO(g *GroupWithRole) groupWithRoleDTO {
	return groupWithRoleDTO{
		ID:       g.ID.String(),
		Name:     g.Name,
		UserRole: g.UserRole,
	}
}

type memberDTO struct {
	ID       string    `json:"id"`
	UserID   string    `json:"user_id"`
	Email    string    `json:"email"`
	Role     Role      `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

func toMemberDTO(m *MemberWithUser) memberDTO {
	return memberDTO{
		ID:       m.MemberID.String(),
		UserID:   m.UserID.String(),
		Email:    m.Email,
		Role:     m.Role,
		JoinedAt: m.JoinedAt,
	}
}

type addMemberRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type changeRoleRequest struct {
	UserID string `json:"user_id" binding:"required"`
	Role   Role   `json:"role" binding:"required,oneof=admin moderator member"`
}

type transferAdminshipRequest struct {
	NewAdminID string `json:"new_admin_id" binding:"required"`
}

type updateGroupRequest struct {
	Name        string `json:"name" binding:"required,max=255"`
	Description string `json:"description" max:"1024"`
}

func (h *Handler) CreateGroup(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req createGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uid, err := uuid.Parse(claims.Subject)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}

	group, err := h.svc.CreateGroup(req.Name, req.Description, uid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, toGroupDTO(group))
}

func (h *Handler) GetUserGroups(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid, err := uuid.Parse(claims.Subject)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}

	groups, err := h.svc.GetUserGroups(uid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := make([]groupWithRoleDTO, 0, len(groups))
	for _, g := range groups {
		result = append(result, toGroupWithRoleDTO(g))
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetGroup(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	group, err := h.svc.GetGroup(groupID)
	if err != nil {
		if err == ErrGroupNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "группа не найдена"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uid, _ := uuid.Parse(claims.Subject)
	isMember, _ := h.svc.IsMember(groupID, uid)
	if !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "доступ запрещен"})
		return
	}

	c.JSON(http.StatusOK, toGroupDTO(group))
}

func (h *Handler) GetGroupMembers(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	uid, _ := uuid.Parse(claims.Subject)
	isMember, _ := h.svc.IsMember(groupID, uid)
	if !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "доступ запрещен"})
		return
	}

	members, err := h.svc.GetGroupMembers(groupID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := make([]memberDTO, 0, len(members))
	for _, m := range members {
		result = append(result, toMemberDTO(m))
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) AddMember(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req addMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	actorID, _ := uuid.Parse(claims.Subject)

	if err := h.svc.AddMemberByEmail(groupID, req.Email, actorID); err != nil {
		switch err {
		case ErrNotAdmin:
			c.JSON(http.StatusForbidden, gin.H{"error": "только администратор может добавлять участников"})
		case ErrMemberExists:
			c.JSON(http.StatusConflict, gin.H{"error": "пользователь уже является участником группы"})
		case ErrMemberNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "группа не найдена"})
		case user.ErrUserNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "пользователь не найден"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "участник добавлен"})
}

func (h *Handler) RemoveMember(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	actorID, _ := uuid.Parse(claims.Subject)

	if err := h.svc.RemoveMember(groupID, userID, actorID); err != nil {
		switch err {
		case ErrNotModeratorOrAdmin:
			c.JSON(http.StatusForbidden, gin.H{"error": "только модератор или администратор может удалять участников"})
		case ErrLastAdmin:
			c.JSON(http.StatusForbidden, gin.H{"error": "нельзя удалить последнего администратора"})
		case ErrMemberNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "участник не найден"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "участник удален"})
}

func (h *Handler) ChangeRole(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req changeRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	actorID, _ := uuid.Parse(claims.Subject)

	if err := h.svc.ChangeRole(groupID, userID, actorID, req.Role); err != nil {
		switch err {
		case ErrNotAdmin:
			c.JSON(http.StatusForbidden, gin.H{"error": "только администратор может изменять роли"})
		case ErrCannotChangeSelf:
			c.JSON(http.StatusBadRequest, gin.H{"error": "нельзя изменить собственную роль"})
		case ErrMemberNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "участник не найден"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "роль изменена"})
}

func (h *Handler) TransferAdminship(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req transferAdminshipRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newAdminID, err := uuid.Parse(req.NewAdminID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	actorID, _ := uuid.Parse(claims.Subject)

	if err := h.svc.TransferAdminship(groupID, newAdminID, actorID); err != nil {
		switch err {
		case ErrNotAdmin:
			c.JSON(http.StatusForbidden, gin.H{"error": "только администратор может передавать права"})
		case ErrMemberNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "участник не найден"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "права администратора переданы"})
}

func (h *Handler) UpdateGroup(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req updateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	actorID, _ := uuid.Parse(claims.Subject)

	if err := h.svc.UpdateGroup(groupID, req.Name, req.Description, actorID); err != nil {
		switch err {
		case ErrNotAdmin:
			c.JSON(http.StatusForbidden, gin.H{"error": "только администратор может редактировать группу"})
		case ErrGroupNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "группа не найдена"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "группа обновлена"})
}

func (h *Handler) DeleteGroup(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	actorID, _ := uuid.Parse(claims.Subject)

	if err := h.svc.DeleteGroup(groupID, actorID); err != nil {
		switch err {
		case ErrNotAdmin:
			c.JSON(http.StatusForbidden, gin.H{"error": "только администратор может удалять группу"})
		case ErrGroupNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "группа не найдена"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "группа удалена"})
}
