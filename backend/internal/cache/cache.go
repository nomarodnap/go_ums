package cache

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/maypok86/otter"
)

// CacheService defines the interface for 2-tier caching
type CacheService interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
	Close() error
}

// HybridCache implements L1 (Otter In-Memory) + L2 (Postgres UNLOGGED TABLE)
type HybridCache struct {
	l1     otter.CacheWithVariableTTL[string, []byte]
	pool   *pgxpool.Pool
	cancel context.CancelFunc
}

// NewHybridCache initializes L1 Otter and verifies/prepares L2 Postgres UNLOGGED table
func NewHybridCache(pool *pgxpool.Pool) (*HybridCache, error) {
	ctx := context.Background()

	// Ensure L2 UNLOGGED TABLE exists
	schema := `
		CREATE UNLOGGED TABLE IF NOT EXISTS app_cache (
			key TEXT PRIMARY KEY,
			value BYTEA NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_app_cache_expires_at ON app_cache(expires_at);
	`
	if pool != nil {
		if _, err := pool.Exec(ctx, schema); err != nil {
			log.Printf("[HybridCache] Warning: failed to ensure app_cache table: %v", err)
		}
	}

	// L1 Otter: capacity 10,000 items with variable TTL
	l1, err := otter.MustBuilder[string, []byte](10_000).
		WithVariableTTL().
		Build()
	if err != nil {
		return nil, fmt.Errorf("failed to build otter L1 cache: %w", err)
	}

	cleanupCtx, cancel := context.WithCancel(context.Background())
	cache := &HybridCache{
		l1:     l1,
		pool:   pool,
		cancel: cancel,
	}

	// Periodic cleanup of expired L2 entries every 10 minutes
	if pool != nil {
		go cache.startJanitor(cleanupCtx, 10*time.Minute)
	}

	log.Println("[HybridCache] Initialized successfully (L1: Otter In-Memory, L2: Postgres UNLOGGED TABLE).")
	return cache, nil
}

func (c *HybridCache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) error {
	// 1. Set in L1 Otter
	c.l1.Set(key, val, ttl)

	// 2. Set in L2 Postgres UNLOGGED TABLE
	if c.pool != nil {
		expiresAt := time.Now().Add(ttl)
		query := `
			INSERT INTO app_cache (key, value, expires_at)
			VALUES ($1, $2, $3)
			ON CONFLICT (key) DO UPDATE
			SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
		`
		_, err := c.pool.Exec(ctx, query, key, val, expiresAt)
		if err != nil {
			log.Printf("[HybridCache] L2 Set error for key %s: %v", key, err)
		}
	}

	return nil
}

func (c *HybridCache) Get(ctx context.Context, key string) ([]byte, error) {
	// 1. Check L1 Otter (sub-microsecond memory lookup)
	if val, ok := c.l1.Get(key); ok {
		return val, nil
	}

	// 2. Check L2 Postgres UNLOGGED TABLE
	if c.pool == nil {
		return nil, fmt.Errorf("key not found in L1 and pool is nil: %s", key)
	}

	var val []byte
	var expiresAt time.Time
	query := `SELECT value, expires_at FROM app_cache WHERE key = $1 AND expires_at > NOW()`
	err := c.pool.QueryRow(ctx, query, key).Scan(&val, &expiresAt)
	if err != nil {
		return nil, err
	}

	// Backfill L1 Otter with remaining TTL
	remaining := time.Until(expiresAt)
	if remaining > 0 {
		c.l1.Set(key, val, remaining)
	}

	return val, nil
}

func (c *HybridCache) Delete(ctx context.Context, key string) error {
	c.l1.Delete(key)
	if c.pool != nil {
		_, err := c.pool.Exec(ctx, `DELETE FROM app_cache WHERE key = $1`, key)
		return err
	}
	return nil
}

func (c *HybridCache) Close() error {
	if c.cancel != nil {
		c.cancel()
	}
	c.l1.Clear()
	return nil
}

func (c *HybridCache) startJanitor(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if c.pool != nil {
				_, _ = c.pool.Exec(context.Background(), `DELETE FROM app_cache WHERE expires_at <= NOW()`)
			}
		}
	}
}
