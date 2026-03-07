package database

import (
	"context"

	"github.com/redis/go-redis/v9"
)

func ConnectRedis(addr, password string, db int) *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
}

func PingRedis(ctx context.Context, rdb *redis.Client) error {
	return rdb.Ping(ctx).Err()
}
