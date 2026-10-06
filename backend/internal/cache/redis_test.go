package cache

import (
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestParseRedisURLWithPassword(t *testing.T) {
	url := "redis://:qBte3j7A4S1p0y4hRNev5AkO@192.168.171.97:6379"
	opt, err := redis.ParseURL(url)
	if err != nil {
		t.Fatalf("failed to parse redis url: %v", err)
	}

	if opt.Addr != "192.168.171.97:6379" {
		t.Errorf("expected addr 192.168.171.97:6379, got %s", opt.Addr)
	}

	if opt.Password != "qBte3j7A4S1p0y4hRNev5AkO" {
		t.Errorf("expected password qBte3j7A4S1p0y4hRNev5AkO, got %s", opt.Password)
	}
}

func TestLiveRedisConnection(t *testing.T) {
	url := "redis://:qBte3j7A4S1p0y4hRNev5AkO@192.168.171.97:6379"
	service := NewRedisService(url)
	defer service.Close()

	ctx, cancel := context.WithTimeout(t.Context(), 1*time.Second)
	defer cancel()

	if err := service.Client.Ping(ctx).Err(); err != nil {
		t.Skipf("skipping live redis test: external redis instance at 192.168.171.97:6379 is not running (%v)", err)
	}
}
