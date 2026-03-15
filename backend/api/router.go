package api

import (
	"SKAM/internal/auth"
	"SKAM/internal/chat"
	"SKAM/internal/config"
	"SKAM/internal/group"
	"SKAM/internal/user"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func SetupRouter(db *gorm.DB, rdb *redis.Client, cfg config.Config) *gin.Engine {
	r := gin.Default()

	tm := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTTTL)
	authSvc := auth.NewService(db, tm)
	authHandler := auth.NewHandler(authSvc)
	qrSvc := auth.NewQRService(rdb, tm, cfg.QRTTL)
	qrHandler := auth.NewQRHandler(qrSvc)
	chatSvc := chat.NewService(db)
	chatHandler := chat.NewHandler(chatSvc)
	groupSvc := group.NewService(db)
	groupHandler := group.NewHandler(groupSvc)
	userSvc := user.NewService(db)
	userHandler := user.NewHandler(userSvc)

	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
		authGroup.GET("/me", auth.Middleware(tm), authHandler.Me)

		authGroup.GET("/qr", qrHandler.Create)
		authGroup.GET("/qr/status", qrHandler.Status)
		authGroup.POST("/qr/confirm", auth.Middleware(tm), qrHandler.Confirm)
	}

	chatGroup := r.Group("/chat", auth.Middleware(tm))
	{
		chatGroup.GET("/messages", chatHandler.List)
		chatGroup.POST("/messages", chatHandler.Send)
		chatGroup.DELETE("/messages/:id", chatHandler.DeleteMessage)
	}

	groupsGroup := r.Group("/groups", auth.Middleware(tm))
	{
		groupsGroup.POST("", groupHandler.CreateGroup)
		groupsGroup.GET("", groupHandler.GetUserGroups)
		groupsGroup.GET("/:id", groupHandler.GetGroup)
		groupsGroup.PUT("/:id", groupHandler.UpdateGroup)
		groupsGroup.DELETE("/:id", groupHandler.DeleteGroup)
		groupsGroup.GET("/:id/members", groupHandler.GetGroupMembers)
		groupsGroup.POST("/:id/members", groupHandler.AddMember)
		groupsGroup.DELETE("/:id/members/:user_id", groupHandler.RemoveMember)
		groupsGroup.PUT("/:id/role", groupHandler.ChangeRole)
		groupsGroup.PUT("/:id/transfer", groupHandler.TransferAdminship)
	}

	usersGroup := r.Group("/users", auth.Middleware(tm))
	{
		usersGroup.GET("", userHandler.SearchUsers)
		usersGroup.GET("/:id", userHandler.GetUserByID)
	}

	return r
}
