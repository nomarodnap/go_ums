package cache

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisService struct {
	Client *redis.Client
}

// NewRedisService initializes a connection to Redis using the provided URL
func NewRedisService(redisURL string) *RedisService {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("[Redis] Warning: Failed to parse REDIS_URL (%s): %v. Trying default Addr...", redisURL, err)
		opt = &redis.Options{
			Addr: "localhost:6379",
		}
	}

	client := redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[Redis] Warning: Unable to connect to Redis at %s (%v). Running without cache/queue.", opt.Addr, err)
	} else {
		log.Printf("[Redis] Connected to Redis successfully at %s.", opt.Addr)
	}

	return &RedisService{Client: client}
}

// Close gracefully closes the Redis connection
func (r *RedisService) Close() error {
	if r.Client != nil {
		return r.Client.Close()
	}
	return nil
}
