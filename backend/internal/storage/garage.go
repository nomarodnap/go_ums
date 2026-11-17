package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/dof/ums-backend/internal/config"
)

type StorageService interface {
	Upload(ctx context.Context, filename string, reader io.Reader, size int64, contentType string) (string, error)
	ServeFile(w http.ResponseWriter, r *http.Request, filename string)
	Delete(ctx context.Context, filename string) error
	IsAvailable() bool
}

type GarageStorage struct {
	client           *s3.Client
	bucket           string
	localFallbackDir string
	available        bool
}

// NewGarageStorage initializes Garage S3 client and ensures the default bucket exists.
// If Garage is unreachable, it logs a warning and gracefully falls back to local disk.
func NewGarageStorage(cfg *config.Config) *GarageStorage {
	storage := &GarageStorage{
		bucket:           cfg.GarageBucket,
		localFallbackDir: cfg.UploadDir,
		available:        false,
	}

	endpoint := cfg.GarageEndpoint
	if endpoint == "" {
		endpoint = "http://localhost:3900"
	} else if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		if cfg.GarageUseSSL {
			endpoint = "https://" + endpoint
		} else {
			endpoint = "http://" + endpoint
		}
	}

	region := cfg.GarageRegion
	if region == "" {
		region = "garage"
	}

	client := s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       region,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.GarageAccessKey, cfg.GarageSecretKey, ""),
		UsePathStyle: true,
	})
	storage.client = client

	// Check connection and ensure bucket exists with a 5-second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(cfg.GarageBucket),
	})
	if err != nil {
		// Attempt to create bucket if it does not exist
		_, createErr := client.CreateBucket(ctx, &s3.CreateBucketInput{
			Bucket: aws.String(cfg.GarageBucket),
		})
		if createErr != nil {
			log.Printf("[Garage] Warning: Cannot reach or initialize Garage S3 bucket at %s (bucket: %s): %v. Local filesystem fallback active (%s).", endpoint, cfg.GarageBucket, createErr, cfg.UploadDir)
			return storage
		}
		log.Printf("[Garage] Created bucket '%s' successfully.", cfg.GarageBucket)
	}

	storage.available = true
	log.Printf("[Garage] Connected successfully to Garage S3 at %s (bucket: %s).", endpoint, cfg.GarageBucket)
	return storage
}

func (s *GarageStorage) IsAvailable() bool {
	return s.available
}

// Upload stores a file either in Garage S3 or local filesystem fallback, returning the standard URL path.
func (s *GarageStorage) Upload(ctx context.Context, filename string, reader io.Reader, size int64, contentType string) (string, error) {
	cleanName := filepath.Base(filename)

	if s.available && s.client != nil {
		buf, err := io.ReadAll(reader)
		if err != nil {
			log.Printf("[Garage] Failed to read upload content: %v. Attempting local fallback...", err)
		} else {
			putInput := &s3.PutObjectInput{
				Bucket:        aws.String(s.bucket),
				Key:           aws.String(cleanName),
				Body:          bytes.NewReader(buf),
				ContentLength: aws.Int64(int64(len(buf))),
			}
			if contentType != "" {
				putInput.ContentType = aws.String(contentType)
			}
			_, err = s.client.PutObject(ctx, putInput)
			if err != nil {
				log.Printf("[Garage] PutObject failed: %v. Attempting local fallback...", err)
				reader = bytes.NewReader(buf)
			} else {
				return "/uploads/" + cleanName, nil
			}
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
	defer func() { _ = dst.Close() }()

	if _, err := io.Copy(dst, reader); err != nil {
		return "", fmt.Errorf("failed to write file content: %w", err)
	}

	return "/uploads/" + cleanName, nil
}

// ServeFile streams the requested file from Garage S3 (or fallback local directory) using http.ServeContent.
func (s *GarageStorage) ServeFile(w http.ResponseWriter, r *http.Request, filename string) {
	cleanName := filepath.Base(filename)
	// Sanitize filename to prevent directory traversal
	if strings.Contains(cleanName, "..") || cleanName == "." || cleanName == "/" {
		http.Error(w, "Invalid filename", http.StatusBadRequest)
		return
	}

	if s.available && s.client != nil {
		output, err := s.client.GetObject(r.Context(), &s3.GetObjectInput{
			Bucket: aws.String(s.bucket),
			Key:    aws.String(cleanName),
		})
		if err == nil {
			defer func() { _ = output.Body.Close() }()
			buf, readErr := io.ReadAll(output.Body)
			if readErr == nil {
				if output.ContentType != nil && *output.ContentType != "" {
					w.Header().Set("Content-Type", *output.ContentType)
				}
				w.Header().Set("Cache-Control", "public, max-age=2592000") // 30 days
				var modTime time.Time
				if output.LastModified != nil {
					modTime = *output.LastModified
				} else {
					modTime = time.Now()
				}
				http.ServeContent(w, r, cleanName, modTime, bytes.NewReader(buf))
				return
			}
		}
	}

	// Fallback to local filesystem if not found in Garage or Garage is offline
	localPath := filepath.Join(s.localFallbackDir, cleanName)
	if fileInfo, err := os.Stat(localPath); err == nil && !fileInfo.IsDir() {
		f, err := os.Open(localPath)
		if err == nil {
			defer func() { _ = f.Close() }()
			w.Header().Set("Cache-Control", "public, max-age=2592000")
			http.ServeContent(w, r, cleanName, fileInfo.ModTime(), f)
			return
		}
	}

	http.NotFound(w, r)
}

// Delete removes an object from Garage S3 and local fallback directory.
func (s *GarageStorage) Delete(ctx context.Context, filename string) error {
	cleanName := filepath.Base(filename)
	var firstErr error

	if s.available && s.client != nil {
		if _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(s.bucket),
			Key:    aws.String(cleanName),
		}); err != nil {
			firstErr = err
		}
	}

	// Also remove from local fallback if exists
	localPath := filepath.Join(s.localFallbackDir, cleanName)
	if err := os.Remove(localPath); err != nil && !os.IsNotExist(err) && firstErr == nil {
		firstErr = err
	}

	return firstErr
}
