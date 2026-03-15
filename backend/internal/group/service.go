package group

import (
	"errors"
	"time"

	"SKAM/internal/user"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrGroupNotFound      = errors.New("группа не найдена")
	ErrMemberNotFound     = errors.New("участник не найден в группе")
	ErrMemberExists       = errors.New("пользователь уже является участником группы")
	ErrNotAdmin           = errors.New("недостаточно прав: требуется роль администратора")
	ErrNotModeratorOrAdmin = errors.New("недостаточно прав: требуется роль модератора или администратора")
	ErrLastAdmin          = errors.New("нельзя удалить последнего администратора")
	ErrCannotChangeSelf   = errors.New("нельзя изменить собственную роль")
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) CreateGroup(name, description string, createdBy uuid.UUID) (*Group, error) {
	group := &Group{
		Name:        name,
		Description: description,
		CreatedBy:   createdBy,
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(group).Error; err != nil {
			return err
		}

		member := &GroupMember{
			GroupID: group.ID,
			UserID:  createdBy,
			Role:    RoleAdmin,
		}
		return tx.Create(member).Error
	})

	if err != nil {
		return nil, err
	}

	return group, nil
}

func (s *Service) GetGroup(id uuid.UUID) (*Group, error) {
	var group Group
	result := s.db.First(&group, "id = ?", id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrGroupNotFound
		}
		return nil, result.Error
	}
	return &group, nil
}

func (s *Service) GetUserGroups(userID uuid.UUID) ([]*GroupWithRole, error) {
	var groups []*GroupWithRole
	err := s.db.Table("groups").
		Joins("JOIN group_members ON group_members.group_id = groups.id").
		Where("group_members.user_id = ?", userID).
		Select("groups.*, group_members.role as user_role").
		Scan(&groups).Error
	if groups == nil {
		groups = []*GroupWithRole{}
	}
	return groups, err
}

type GroupWithRole struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	Name      string    `gorm:"not null;size:255"`
	CreatedBy uuid.UUID `gorm:"type:uuid;not null"`
	UserRole  Role      `gorm:"column:user_role"`
}

func (s *Service) GetGroupMembers(groupID uuid.UUID) ([]*MemberWithUser, error) {
	var members []*MemberWithUser
	err := s.db.Table("group_members").
		Joins("JOIN users ON users.id = group_members.user_id").
		Where("group_members.group_id = ?", groupID).
		Select("group_members.id as member_id, group_members.group_id, group_members.user_id, group_members.role, group_members.joined_at, users.email").
		Scan(&members).Error
	return members, err
}

type MemberWithUser struct {
	MemberID  uuid.UUID `gorm:"column:member_id"`
	GroupID   uuid.UUID
	UserID    uuid.UUID
	Email     string
	Role      Role
	JoinedAt  time.Time
}

func (s *Service) GetMember(groupID, userID uuid.UUID) (*GroupMember, error) {
	var member GroupMember
	result := s.db.Where("group_id = ? AND user_id = ?", groupID, userID).First(&member)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrMemberNotFound
		}
		return nil, result.Error
	}
	return &member, nil
}

func (s *Service) AddMember(groupID, userID, actorID uuid.UUID) error {
	actorMember, err := s.GetMember(groupID, actorID)
	if err != nil {
		return err
	}
	if actorMember.Role != RoleAdmin {
		return ErrNotAdmin
	}

	var existing GroupMember
	result := s.db.Where("group_id = ? AND user_id = ?", groupID, userID).First(&existing)
	if result.Error == nil {
		return ErrMemberExists
	}

	member := &GroupMember{
		GroupID: groupID,
		UserID:  userID,
		Role:    RoleMember,
	}
	return s.db.Create(member).Error
}

func (s *Service) AddMemberByEmail(groupID uuid.UUID, email string, actorID uuid.UUID) error {
	actorMember, err := s.GetMember(groupID, actorID)
	if err != nil {
		return err
	}
	if actorMember.Role != RoleAdmin {
		return ErrNotAdmin
	}

	db := s.db
	userService := user.NewService(db)
	targetUser, err := userService.GetByEmail(email)
	if err != nil {
		return err
	}

	var existing GroupMember
	result := s.db.Where("group_id = ? AND user_id = ?", groupID, targetUser.ID).First(&existing)
	if result.Error == nil {
		return ErrMemberExists
	}

	member := &GroupMember{
		GroupID: groupID,
		UserID:  targetUser.ID,
		Role:    RoleMember,
	}
	return s.db.Create(member).Error
}


func (s *Service) RemoveMember(groupID, userID, actorID uuid.UUID) error {
	actorMember, err := s.GetMember(groupID, actorID)
	if err != nil {
		return err
	}
	if actorMember.Role != RoleAdmin && actorMember.Role != RoleModerator {
		return ErrNotModeratorOrAdmin
	}

	targetMember, err := s.GetMember(groupID, userID)
	if err != nil {
		return err
	}

	if targetMember.Role == RoleAdmin {
		adminCount, err := s.getAdminCount(groupID)
		if err != nil {
			return err
		}
		if adminCount <= 1 {
			return ErrLastAdmin
		}
	}

	return s.db.Where("group_id = ? AND user_id = ?", groupID, userID).Delete(&GroupMember{}).Error
}

func (s *Service) ChangeRole(groupID, userID, actorID uuid.UUID, newRole Role) error {
	actorMember, err := s.GetMember(groupID, actorID)
	if err != nil {
		return err
	}
	if actorMember.Role != RoleAdmin {
		return ErrNotAdmin
	}

	if actorID == userID {
		return ErrCannotChangeSelf
	}

	targetMember, err := s.GetMember(groupID, userID)
	if err != nil {
		return err
	}

	if targetMember.Role == RoleAdmin {
		return ErrNotAdmin
	}

	return s.db.Model(&GroupMember{}).
		Where("group_id = ? AND user_id = ?", groupID, userID).
		Update("role", newRole).Error
}

func (s *Service) TransferAdminship(groupID, newAdminID, currentAdminID uuid.UUID) error {
	currentMember, err := s.GetMember(groupID, currentAdminID)
	if err != nil {
		return err
	}
	if currentMember.Role != RoleAdmin {
		return ErrNotAdmin
	}

	_, err = s.GetMember(groupID, newAdminID)
	if err != nil {
		return err
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&GroupMember{}).
			Where("group_id = ? AND user_id = ?", groupID, currentAdminID).
			Update("role", RoleModerator).Error; err != nil {
			return err
		}

		return tx.Model(&GroupMember{}).
			Where("group_id = ? AND user_id = ?", groupID, newAdminID).
			Update("role", RoleAdmin).Error
	})

	return err
}

func (s *Service) UpdateGroup(groupID uuid.UUID, name, description string, actorID uuid.UUID) error {
	member, err := s.GetMember(groupID, actorID)
	if err != nil {
		return err
	}
	if member.Role != RoleAdmin {
		return ErrNotAdmin
	}

	return s.db.Model(&Group{}).
		Where("id = ?", groupID).
		Updates(map[string]interface{}{
			"name":        name,
			"description": description,
		}).Error
}

func (s *Service) DeleteGroup(groupID, actorID uuid.UUID) error {
	member, err := s.GetMember(groupID, actorID)
	if err != nil {
		return err
	}
	if member.Role != RoleAdmin {
		return ErrNotAdmin
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("group_id = ?", groupID).Delete(&GroupMember{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", groupID).Delete(&Group{}).Error
	})
}

func (s *Service) IsAdmin(groupID, userID uuid.UUID) (bool, error) {
	member, err := s.GetMember(groupID, userID)
	if err != nil {
		if errors.Is(err, ErrMemberNotFound) {
			return false, nil
		}
		return false, err
	}
	return member.Role == RoleAdmin, nil
}

func (s *Service) IsModeratorOrAdmin(groupID, userID uuid.UUID) (bool, error) {
	member, err := s.GetMember(groupID, userID)
	if err != nil {
		if errors.Is(err, ErrMemberNotFound) {
			return false, nil
		}
		return false, err
	}
	return member.Role == RoleModerator || member.Role == RoleAdmin, nil
}

func (s *Service) getAdminCount(groupID uuid.UUID) (int64, error) {
	var count int64
	err := s.db.Model(&GroupMember{}).
		Where("group_id = ? AND role = ?", groupID, RoleAdmin).
		Count(&count).Error
	return count, err
}

func (s *Service) IsMember(groupID, userID uuid.UUID) (bool, error) {
	_, err := s.GetMember(groupID, userID)
	if err != nil {
		if errors.Is(err, ErrMemberNotFound) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}
