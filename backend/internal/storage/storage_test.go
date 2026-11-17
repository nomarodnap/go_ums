package storage_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/dof/ums-backend/internal/config"
	"github.com/dof/ums-backend/internal/storage"
)

func TestStorageLocalFallback(t *testing.T) {
	tempDir := t.TempDir()
	cfg := &config.Config{
		GarageEndpoint: "http://invalid-garage-host:9999",
		GarageBucket:   "test-bucket",
		GarageRegion:   "garage",
		UploadDir:      tempDir,
	}

	svc := storage.NewGarageStorage(cfg)
	if svc == nil {
		t.Fatal("expected non-nil storage instance")
	}

	// 1. Test Upload via local fallback
	content := "Hello Garage S3 and Local Fallback"
	reader := strings.NewReader(content)
	filename := "test-doc.txt"

	url, err := svc.Upload(context.Background(), filename, reader, int64(len(content)), "text/plain")
	if err != nil {
		t.Fatalf("expected no error uploading to local fallback, got: %v", err)
	}

	expectedPrefix := "/uploads/test-doc.txt"
	if url != expectedPrefix {
		t.Errorf("expected URL %s, got: %s", expectedPrefix, url)
	}

	// Verify file on disk
	filePath := filepath.Join(tempDir, filename)
	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read written file: %v", err)
	}
	if string(data) != content {
		t.Errorf("expected content '%s', got '%s'", content, string(data))
	}

	// 2. Test ServeFile
	req := httptest.NewRequest("GET", "/uploads/"+filename, nil)
	rr := httptest.NewRecorder()
	svc.ServeFile(rr, req, filename)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}
	if rr.Body.String() != content {
		t.Errorf("expected body '%s', got '%s'", content, rr.Body.String())
	}

	// 3. Test Delete
	if err := svc.Delete(context.Background(), filename); err != nil {
		t.Fatalf("expected no error deleting file, got: %v", err)
	}

	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Errorf("expected file to be deleted from disk, but it still exists")
	}
}

func TestGarageLiveConnection(t *testing.T) {
	tempDir := t.TempDir()
	cfg := &config.Config{
		GarageEndpoint:  "http://localhost:3900",
		GarageAccessKey: "GK8d2c00f6d172b00fdaa58991",
		GarageSecretKey: "423094fbc4e36a7ff2770fae80c84ae06ef1408b516446248eae65da8e439ff0",
		GarageRegion:    "garage",
		GarageBucket:    "ums-uploads",
		GarageUseSSL:    false,
		UploadDir:       tempDir,
	}

	svc := storage.NewGarageStorage(cfg)
	if svc == nil {
		t.Fatal("expected non-nil storage instance")
	}

	if !svc.IsAvailable() {
		t.Skip("Garage is not available on localhost:3900, skipping live test")
	}

	// 1. Test live Upload to Garage S3
	content := "Hello Live Garage Object Storage!"
	reader := strings.NewReader(content)
	filename := "live-test-doc.txt"

	url, err := svc.Upload(context.Background(), filename, reader, int64(len(content)), "text/plain")
	if err != nil {
		t.Fatalf("expected no error uploading to Garage S3, got: %v", err)
	}

	expectedPrefix := "/uploads/live-test-doc.txt"
	if url != expectedPrefix {
		t.Errorf("expected URL %s, got: %s", expectedPrefix, url)
	}

	// 2. Test ServeFile from Garage S3
	req := httptest.NewRequest("GET", "/uploads/"+filename, nil)
	rr := httptest.NewRecorder()
	svc.ServeFile(rr, req, filename)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}
	if rr.Body.String() != content {
		t.Errorf("expected body '%s', got '%s'", content, rr.Body.String())
	}

	// 3. Test Delete from Garage S3
	if err := svc.Delete(context.Background(), filename); err != nil {
		t.Fatalf("expected no error deleting file from Garage S3, got: %v", err)
	}

	// Verify file is gone from Garage S3
	rrAfterDelete := httptest.NewRecorder()
	svc.ServeFile(rrAfterDelete, req, filename)
	if rrAfterDelete.Code != http.StatusNotFound {
		t.Errorf("expected status 404 after delete, got %d", rrAfterDelete.Code)
	}
}
