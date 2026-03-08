package main

import (
	"SKAM/api"
	"SKAM/internal/config"
	"SKAM/internal/database"
	"SKAM/internal/chat"
	"SKAM/internal/user"
	"context"
	"log"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DBDSN)
	if err != nil {
		log.Fatal(err)
	}

	if err := db.AutoMigrate(&user.User{}, &chat.Message{}); err != nil {
		log.Fatal(err)
	}

	rdb := database.ConnectRedis(cfg.RedisAddr, cfg.RedisPass, cfg.RedisDB)
	if err := database.PingRedis(context.Background(), rdb); err != nil {
		log.Fatal(err)
	}

	router := api.SetupRouter(db, rdb, cfg)
	if err := router.Run(cfg.ServerAddr); err != nil {
		log.Fatal(err)
	}
}
