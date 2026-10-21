package storage

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dof/ums-backend/internal/config"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type StorageService interface {
	Upload(ctx context.Context, filename string, reader io.Reader, size int64, contentType string) (string, error)
	ServeFile(w http.ResponseWriter, r *http.Request, filename string)
	Delete(ctx context.Context, filename string) error
	IsAvailable() bool
}

type MinIOStorage struct {
	client           *minio.Client
	bucket           string
	localFallbackDir string
	available        bool
}

// NewMinIOStorage initializes MinIO client and ensures the default bucket exists.
// If MinIO is unreachable, it logs a warning and gracefully falls back to local disk.
func NewMinIOStorage(cfg *config.Config) *MinIOStorage {
	storage := &MinIOStorage{
		bucket:           cfg.MinioBucket,
		localFallbackDir: cfg.UploadDir,
		available:        false,
	}

	client, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: cfg.MinioUseSSL,
	})
	if err != nil {
		log.Printf("[MinIO] Warning: Failed to initialize MinIO client: %v. Falling back to local directory: %s", err, cfg.UploadDir)
		return storage
	}
	storage.client = client

	// Check connection and ensure bucket exists with a 5-second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	exists, err := client.BucketExists(ctx, cfg.MinioBucket)
	if err != nil {
		log.Printf("[MinIO] Warning: Cannot reach MinIO server at %s: %v. Local filesystem fallback active (%s).", cfg.MinioEndpoint, err, cfg.UploadDir)
		return storage
	}

	if !exists {
		err = client.MakeBucket(ctx, cfg.MinioBucket, minio.MakeBucketOptions{})
		if err != nil {
			log.Printf("[MinIO] Warning: Failed to create bucket %s: %v", cfg.MinioBucket, err)
			return storage
		}
		log.Printf("[MinIO] Created bucket '%s' successfully.", cfg.MinioBucket)
	}

	storage.available = true
	log.Printf("[MinIO] Connected successfully to MinIO at %s (bucket: %s).", cfg.MinioEndpoint, cfg.MinioBucket)
	return storage
}

func (s *MinIOStorage) IsAvailable() bool {
	return s.available
}

// Upload stores a file either in MinIO or local filesystem fallback, returning the standard URL path.
func (s *MinIOStorage) Upload(ctx context.Context, filename string, reader io.Reader, size int64, contentType string) (string, error) {
	cleanName := filepath.Base(filename)

	if s.available && s.client != nil {
		_, err := s.client.PutObject(ctx, s.bucket, cleanName, reader, size, minio.PutObjectOptions{
			ContentType: contentType,
		})
		if err != nil {
			log.Printf("[MinIO] PutObject failed: %v. Attempting local fallback...", err)
		} else {
			return "/uploads/" + cleanName, nil
		}
	}

	// Local filesystem fallback
	if err := os.MkdirAll(s.localFallbackDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create upload directory: %w", err)
	}

	dstPath := filepath.Join(s.localFallbackDir, cleanName)
	dst, err := os.Create(dstPath)
	if err != nil {
		return "", fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, reader); err != nil {
		return "", fmt.Errorf("failed to write file content: %w", err)
	}

	return "/uploads/" + cleanName, nil
}

// ServeFile streams the requested file from MinIO (or fallback local directory) using http.ServeContent.
func (s *MinIOStorage) ServeFile(w http.ResponseWriter, r *http.Request, filename string) {
	cleanName := filepath.Base(filename)
	// Sanitize filename to prevent directory traversal
	if strings.Contains(cleanName, "..") || cleanName == "." || cleanName == "/" {
		http.Error(w, "Invalid filename", http.StatusBadRequest)
		return
	}

	if s.available && s.client != nil {
		obj, err := s.client.GetObject(r.Context(), s.bucket, cleanName, minio.GetObjectOptions{})
		if err == nil {
			defer obj.Close()
			stat, err := obj.Stat()
			if err == nil {
				if stat.ContentType != "" {
					w.Header().Set("Content-Type", stat.ContentType)
				}
				w.Header().Set("Cache-Control", "public, max-age=2592000") // 30 days
				http.ServeContent(w, r, cleanName, stat.LastModified, obj)
				return
			}
		}
	}

	// Fallback to local filesystem if not found in MinIO or MinIO is offline
	localPath := filepath.Join(s.localFallbackDir, cleanName)
	if fileInfo, err := os.Stat(localPath); err == nil && !fileInfo.IsDir() {
		f, err := os.Open(localPath)
		if err == nil {
			defer f.Close()
			w.Header().Set("Cache-Control", "public, max-age=2592000")
			http.ServeContent(w, r, cleanName, fileInfo.ModTime(), f)
			return
		}
	}

	http.NotFound(w, r)
}

// Delete removes an object from MinIO and local fallback directory.
func (s *MinIOStorage) Delete(ctx context.Context, filename string) error {
	cleanName := filepath.Base(filename)
	var firstErr error

	if s.available && s.client != nil {
		if err := s.client.RemoveObject(ctx, s.bucket, cleanName, minio.RemoveObjectOptions{}); err != nil {
			firstErr = err
		}
	}

	localPath := filepath.Join(s.localFallbackDir, cleanName)
	if err := os.Remove(localPath); err != nil && !os.IsNotExist(err) && firstErr == nil {
		firstErr = err
	}

	return firstErr
}
