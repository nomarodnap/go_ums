package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

func TestPostgresContainer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping testcontainers in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pgContainer, err := postgres.Run(ctx,
		"postgres:16-alpine",
		postgres.WithDatabase("test_ums"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("password"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").WithOccurrence(2).WithStartupTimeout(20*time.Second),
		),
	)
	if err != nil {
		t.Skipf("skipping testcontainers test: docker environment not available or error: %v", err)
		return
	}
	defer func() {
		_ = pgContainer.Terminate(context.Background())
	}()

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("failed to get connection string: %v", err)
	}

	if connStr == "" {
		t.Errorf("expected non-empty connection string")
	}
}
