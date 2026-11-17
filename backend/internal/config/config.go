package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	DatabaseURL        string
	DirectURL          string
	JWTSecret          string
	CORSOrigin         string
	UploadDir          string
	AppURL             string
	SMTPHost           string
	SMTPPort           string
	SMTPUser           string
	SMTPPass           string
	SMTPFromName       string
	SMTPFromEmail      string
	GarageEndpoint     string
	GarageAccessKey    string
	GarageSecretKey    string
	GarageRegion       string
	GarageUseSSL       bool
	GarageBucket       string
	GeminiAPIKey       string
	GeminiModel        string
	LineMessagingToken string
	LineChannelSecret  string
}

func LoadConfig() *Config {
	envPaths := []string{
		"backend/.env",
		".env",
		"../.env",
		"../../.env",
		"../../../.env",
	}
	var loadedPaths []string
	for _, p := range envPaths {
		if _, err := os.Stat(p); err == nil {
			if err := godotenv.Load(p); err == nil {
				loadedPaths = append(loadedPaths, p)
			}
		}
	}
	if len(loadedPaths) > 0 {
		log.Printf("[Config] Loaded environment variables from: %v", loadedPaths)
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

	directURL := os.Getenv("DIRECT_URL")
	if directURL == "" {
		directURL = dbURL
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

	garageEndpoint := os.Getenv("GARAGE_ENDPOINT")
	if garageEndpoint == "" {
		garageEndpoint = os.Getenv("S3_ENDPOINT")
	}
	if garageEndpoint == "" {
		garageEndpoint = os.Getenv("MINIO_ENDPOINT")
	}
	if garageEndpoint == "" {
		garageEndpoint = "localhost:3900"
	}

	garageAccessKey := os.Getenv("GARAGE_ACCESS_KEY")
	if garageAccessKey == "" {
		garageAccessKey = os.Getenv("S3_ACCESS_KEY")
	}
	if garageAccessKey == "" {
		garageAccessKey = os.Getenv("MINIO_ACCESS_KEY")
	}
	if garageAccessKey == "" {
		garageAccessKey = "ums-access-key"
	}

	garageSecretKey := os.Getenv("GARAGE_SECRET_KEY")
	if garageSecretKey == "" {
		garageSecretKey = os.Getenv("S3_SECRET_KEY")
	}
	if garageSecretKey == "" {
		garageSecretKey = os.Getenv("MINIO_SECRET_KEY")
	}
	if garageSecretKey == "" {
		garageSecretKey = "ums-secret-key"
	}

	garageRegion := os.Getenv("GARAGE_REGION")
	if garageRegion == "" {
		garageRegion = os.Getenv("S3_REGION")
	}
	if garageRegion == "" {
		garageRegion = "garage"
	}

	garageUseSSL := os.Getenv("GARAGE_USE_SSL") == "true" || os.Getenv("S3_USE_SSL") == "true" || os.Getenv("MINIO_USE_SSL") == "true"

	garageBucket := os.Getenv("GARAGE_BUCKET")
	if garageBucket == "" {
		garageBucket = os.Getenv("S3_BUCKET")
	}
	if garageBucket == "" {
		garageBucket = os.Getenv("MINIO_BUCKET")
	}
	if garageBucket == "" {
		garageBucket = "ums-uploads"
	}

	geminiAPIKey := os.Getenv("GEMINI_API_KEY")
	geminiModel := os.Getenv("GEMINI_MODEL")
	if geminiModel == "" {
		geminiModel = "gemini-3.5-flash-lite"
	}

	lineToken := os.Getenv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN")
	lineSecret := os.Getenv("LINE_MESSAGING_CHANNEL_SECRET")
	log.Printf("[Config] Loaded environment: PORT=%s, GeminiModel=%s, HasGeminiKey=%v, HasLineToken=%v, HasLineSecret=%v",
		port, geminiModel, geminiAPIKey != "", lineToken != "", lineSecret != "")

	return &Config{
		Port:               port,
		DatabaseURL:        dbURL,
		DirectURL:          directURL,
		JWTSecret:          jwtSecret,
		CORSOrigin:         corsOrigin,
		UploadDir:          uploadDir,
		AppURL:             appURL,
		SMTPHost:           os.Getenv("SMTP_HOST"),
		SMTPPort:           smtpPort,
		SMTPUser:           os.Getenv("SMTP_USER"),
		SMTPPass:           os.Getenv("SMTP_PASS"),
		SMTPFromName:       os.Getenv("SMTP_FROM_NAME"),
		SMTPFromEmail:      os.Getenv("SMTP_FROM_EMAIL"),
		GarageEndpoint:     garageEndpoint,
		GarageAccessKey:    garageAccessKey,
		GarageSecretKey:    garageSecretKey,
		GarageRegion:       garageRegion,
		GarageUseSSL:       garageUseSSL,
		GarageBucket:       garageBucket,
		GeminiAPIKey:       geminiAPIKey,
		GeminiModel:        geminiModel,
		LineMessagingToken: lineToken,
		LineChannelSecret:  lineSecret,
	}
}
