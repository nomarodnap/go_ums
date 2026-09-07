package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	DatabaseURL   string
	JWTSecret     string
	CORSOrigin    string
	UploadDir     string
	AppURL        string
	SMTPHost      string
	SMTPPort      string
	SMTPUser      string
	SMTPPass      string
	SMTPFromName  string
	SMTPFromEmail string
}

func LoadConfig() *Config {
	envPaths := []string{
		".env",
		"backend/.env",
		"../.env",
		"../../.env",
		"../../../.env",
	}
	loadedFrom := ""
	for _, p := range envPaths {
		if _, err := os.Stat(p); err == nil {
			if err := godotenv.Load(p); err == nil {
				loadedFrom = p
				break
			}
		}
	}
	if loadedFrom != "" {
		log.Printf("[Config] Loaded environment variables from: %s", loadedFrom)
	} else {
		log.Println("[Config] WARNING: No .env file found in search paths!")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("[Config] WARNING: DATABASE_URL not set, falling back to localhost:5432/new_ums")
		dbURL = "postgres://postgres:postgres@localhost:5432/new_ums?sslmode=disable"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "fisheries-super-secret-jwt-key-2026-very-secure"
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "http://localhost:3000"
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}

	smtpPort := os.Getenv("SMTP_PORT")
	if smtpPort == "" {
		smtpPort = "587"
	}

	return &Config{
		Port:          port,
		DatabaseURL:   dbURL,
		JWTSecret:     jwtSecret,
		CORSOrigin:    corsOrigin,
		UploadDir:     uploadDir,
		AppURL:        appURL,
		SMTPHost:      os.Getenv("SMTP_HOST"),
		SMTPPort:      smtpPort,
		SMTPUser:      os.Getenv("SMTP_USER"),
		SMTPPass:      os.Getenv("SMTP_PASS"),
		SMTPFromName:  os.Getenv("SMTP_FROM_NAME"),
		SMTPFromEmail: os.Getenv("SMTP_FROM_EMAIL"),
	}
}
