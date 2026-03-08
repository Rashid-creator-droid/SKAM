package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	DBDSN      string
	RedisAddr  string
	RedisPass  string
	RedisDB    int
	JWTSecret  string
	JWTTTL     time.Duration
	QRTTL      time.Duration
	ServerAddr string
}

func Load() Config {
	cfg := Config{
		DBDSN:      getenv("DB_DSN", "host=localhost user=postgres password=postgres dbname=skam port=5432 sslmode=disable"),
		RedisAddr:  getenv("REDIS_ADDR", "localhost:6379"),
		RedisPass:  getenv("REDIS_PASSWORD", ""),
		JWTSecret:  getenv("JWT_SECRET", "aboba"),
		ServerAddr: getenv("SERVER_ADDR", ":8080"),
	}

	ttlMin := getenvInt("JWT_TTL_MINUTES", 60*24)
	cfg.JWTTTL = time.Duration(ttlMin) * time.Minute

	cfg.RedisDB = getenvInt("REDIS_DB", 0)

	qrTTLSeconds := getenvInt("QR_TTL_SECONDS", 60)
	cfg.QRTTL = time.Duration(qrTTLSeconds) * time.Second

	return cfg
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getenvInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
