package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

var (
	ErrQRNotFound   = errors.New("qr token not found")
	ErrQRExpired    = errors.New("qr token expired")
	ErrQRNotReady   = errors.New("qr token not confirmed")
	ErrQRAlreadyUsed = errors.New("qr token already used")
)

type QRService struct {
	rdb *redis.Client
	tm  *TokenManager
	ttl time.Duration
}

func NewQRService(rdb *redis.Client, tm *TokenManager, ttl time.Duration) *QRService {
	return &QRService{rdb: rdb, tm: tm, ttl: ttl}
}

func (s *QRService) Create(ctx context.Context) (token string, expiresInSeconds int, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", 0, err
	}
	token = base64.RawURLEncoding.EncodeToString(b)

	key := qrKey(token)
	now := time.Now().Unix()

	pipe := s.rdb.TxPipeline()
	pipe.HSet(ctx, key,
		"status", "pending",
		"created_at", now,
	)
	pipe.Expire(ctx, key, s.ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return "", 0, err
	}

	return token, int(s.ttl.Seconds()), nil
}

func (s *QRService) Confirm(ctx context.Context, token string, userID uuid.UUID, email string) error {
	key := qrKey(token)

	script := redis.NewScript(`
local key = KEYS[1]
if redis.call("EXISTS", key) == 0 then
  return -1
end
local status = redis.call("HGET", key, "status")
if status == "used" then
  return -3
end
if status ~= "pending" then
  return -2
end
redis.call("HSET", key, "status", "confirmed", "user_id", ARGV[1], "email", ARGV[2], "web_jwt", ARGV[3], "confirmed_at", ARGV[4])
return 1
`)

	webJWT, err := s.tm.Issue(userID, email)
	if err != nil {
		return err
	}

	res, err := script.Run(ctx, s.rdb, []string{key},
		userID.String(),
		email,
		webJWT,
		time.Now().Unix(),
	).Int()
	if err != nil {
		return err
	}

	switch res {
	case -1:
		return ErrQRNotFound
	case -2:
		return ErrQRExpired
	case -3:
		return ErrQRAlreadyUsed
	default:
		return nil
	}
}

type QRStatus struct {
	Status string
	Token  string
	UserID string
	Email  string
}

func (s *QRService) Status(ctx context.Context, token string) (QRStatus, error) {
	key := qrKey(token)
	m, err := s.rdb.HGetAll(ctx, key).Result()
	if err != nil {
		return QRStatus{}, err
	}
	if len(m) == 0 {
		return QRStatus{}, ErrQRNotFound
	}

	st := m["status"]
	switch st {
	case "pending":
		return QRStatus{Status: "pending"}, nil
	case "confirmed":
		return QRStatus{
			Status: "confirmed",
			Token:  m["web_jwt"],
			UserID: m["user_id"],
			Email:  m["email"],
		}, nil
	case "used":
		return QRStatus{Status: "used"}, nil
	default:
		return QRStatus{Status: "pending"}, nil
	}
}

func (s *QRService) ConsumeConfirmed(ctx context.Context, token string) (QRStatus, error) {
	key := qrKey(token)

	script := redis.NewScript(`
local key = KEYS[1]
if redis.call("EXISTS", key) == 0 then
  return {-1}
end
local status = redis.call("HGET", key, "status")
if status == "pending" then
  return {-2}
end
if status == "used" then
  return {-3}
end
local jwt = redis.call("HGET", key, "web_jwt")
local uid = redis.call("HGET", key, "user_id")
local email = redis.call("HGET", key, "email")
redis.call("HSET", key, "status", "used")
redis.call("EXPIRE", key, 15)
return {jwt, uid, email}
`)

	vals, err := script.Run(ctx, s.rdb, []string{key}).Result()
	if err != nil {
		return QRStatus{}, err
	}

	arr, ok := vals.([]any)
	if !ok || len(arr) == 0 {
		return QRStatus{}, errors.New("unexpected redis response")
	}

	if len(arr) == 1 {
		switch n := arr[0].(type) {
		case int64:
			switch n {
			case -1:
				return QRStatus{}, ErrQRNotFound
			case -2:
				return QRStatus{}, ErrQRNotReady
			case -3:
				return QRStatus{}, ErrQRAlreadyUsed
			default:
				return QRStatus{}, errors.New("unexpected status code")
			}
		default:
			return QRStatus{}, errors.New("unexpected status code type")
		}
	}

	if len(arr) < 3 {
		return QRStatus{}, errors.New("unexpected redis response")
	}

	jwtStr, _ := arr[0].(string)
	uid, _ := arr[1].(string)
	email, _ := arr[2].(string)

	return QRStatus{
		Status: "confirmed",
		Token:  jwtStr,
		UserID: uid,
		Email:  email,
	}, nil
}

func qrKey(token string) string {
	return "auth:qr:" + token
}

