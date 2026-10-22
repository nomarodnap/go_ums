package cache

import (
	"context"
	"testing"
	"time"
)

func TestHybridCacheL1Only(t *testing.T) {
	cache, err := NewHybridCache(nil)
	if err != nil {
		t.Fatalf("Failed to create hybrid cache: %v", err)
	}
	defer cache.Close()

	ctx := context.Background()
	key := "test_key"
	val := []byte("test_value")

	err = cache.Set(ctx, key, val, 1*time.Minute)
	if err != nil {
		t.Fatalf("Failed to set key: %v", err)
	}

	got, err := cache.Get(ctx, key)
	if err != nil {
		t.Fatalf("Failed to get key: %v", err)
	}
	if string(got) != string(val) {
		t.Fatalf("Expected %s, got %s", string(val), string(got))
	}

	err = cache.Delete(ctx, key)
	if err != nil {
		t.Fatalf("Failed to delete key: %v", err)
	}

	_, err = cache.Get(ctx, key)
	if err == nil {
		t.Fatalf("Expected error after delete, got nil")
	}
}
