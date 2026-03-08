package api

import (
	"SKAM/internal/auth"
	"SKAM/internal/chat"
	"SKAM/internal/config"

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
	}

	return r
}
