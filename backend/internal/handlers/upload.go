package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/dof/ums-backend/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type UploadResponse struct {
	URL          string `json:"url"`
	Filename     string `json:"filename"`
	OriginalName string `json:"originalName"`
	Size         int64  `json:"size"`
	ContentType  string `json:"contentType"`
}

var nonAlphaNumRegex = regexp.MustCompile(`[^a-zA-Z0-9.-]`)

// RegisterUploadRoutes registers the file upload and file serving endpoints on Chi router.
func RegisterUploadRoutes(router chi.Router, storage storage.StorageService) {
	// 1. Upload endpoint (Max 50MB)
	router.Post("/api/upload", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 50<<20) // 50 MB limit
		if err := r.ParseMultipartForm(50 << 20); err != nil {
			http.Error(w, fmt.Sprintf("File too large or invalid multipart form: %v", err), http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "Field 'file' is required in form-data", http.StatusBadRequest)
			return
		}
		defer func() { _ = file.Close() }()

		cleanBase := filepath.Base(header.Filename)
		ext := filepath.Ext(cleanBase)
		base := strings.TrimSuffix(cleanBase, ext)
		base = nonAlphaNumRegex.ReplaceAllString(base, "_")
		if len(base) > 50 {
			base = base[:50]
		}
		if base == "" {
			base = "file"
		}

		filename := fmt.Sprintf("%s-%s%s", uuid.New().String(), base, ext)

		contentType := header.Header.Get("Content-Type")
		if contentType == "" || contentType == "application/octet-stream" {
			// Read first 512 bytes to sniff mime type
			buffer := make([]byte, 512)
			n, _ := file.Read(buffer)
			if n > 0 {
				contentType = http.DetectContentType(buffer[:n])
			}
			// Rewind
			if seeker, ok := file.(interface{ Seek(int64, int) (int64, error) }); ok {
				_, _ = seeker.Seek(0, 0)
			}
		}

		urlPath, err := storage.Upload(r.Context(), filename, file, header.Size, contentType)
		if err != nil {
			log.Printf("[Upload] Error uploading file %s: %v", filename, err)
			http.Error(w, fmt.Sprintf("Failed to store file: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(UploadResponse{
			URL:          urlPath,
			Filename:     filename,
			OriginalName: header.Filename,
			Size:         header.Size,
			ContentType:  contentType,
		})
	})

	// 2. Serve uploaded files (MinIO / fallback)
	router.Get("/uploads/{filename}", func(w http.ResponseWriter, r *http.Request) {
		filename := chi.URLParam(r, "filename")
		storage.ServeFile(w, r, filename)
	})

	// 3. Delete uploaded file
	router.Delete("/api/upload/{filename}", func(w http.ResponseWriter, r *http.Request) {
		filename := chi.URLParam(r, "filename")
		if err := storage.Delete(r.Context(), filename); err != nil {
			http.Error(w, fmt.Sprintf("Failed to delete file: %v", err), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	})
}
