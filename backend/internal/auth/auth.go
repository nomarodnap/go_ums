package auth

import (
	"context"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/crypto/scrypt"
)

type contextKey string

const (
	UserContextKey contextKey = "currentUser"
)

type Claims struct {
	UserID       string `json:"userId"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	Role         string `json:"role"`
	DepartmentID string `json:"departmentId,omitempty"`
	jwt.RegisteredClaims
}

// HashPassword hashes a plain password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(bytes), err
}

// CheckPasswordHash supports both Better Auth scrypt format (salt:keyHex) and standard bcrypt
func CheckPasswordHash(password, storedHash string) bool {
	if storedHash == "" {
		return false
	}

	// 1. Check Better Auth scrypt format: <salt_hex>:<hash_hex>
	if strings.Contains(storedHash, ":") {
		parts := strings.Split(storedHash, ":")
		if len(parts) == 2 {
			salt := parts[0]
			expectedKeyHex := parts[1]
			// Better Auth scrypt params: N=16384, r=16, p=1, keyLen=64
			derived, err := scrypt.Key([]byte(password), []byte(salt), 16384, 16, 1, 64)
			if err == nil {
				return hex.EncodeToString(derived) == expectedKeyHex
			}
		}
	}

	// 2. Fallback to standard bcrypt
	err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(password))
	return err == nil
}

// GenerateToken creates a JWT token valid for 7 days
func GenerateToken(userID, email, name, role, departmentID, secret string) (string, error) {
	expirationTime := time.Now().Add(7 * 24 * time.Hour)
	claims := &Claims{
		UserID:       userID,
		Email:        email,
		Name:         name,
		Role:         role,
		DepartmentID: departmentID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   userID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateToken parses and validates a JWT token string
func ValidateToken(tokenString, secret string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// UserFromContext retrieves current user claims from request context
func UserFromContext(ctx context.Context) (*Claims, bool) {
	user, ok := ctx.Value(UserContextKey).(*Claims)
	return user, ok
}

// AuthMiddleware creates an HTTP middleware that extracts JWT from Authorization header or cookie
func AuthMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := ""

			// Check Bearer Token in Authorization header
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
			} else {
				// Check auth_token cookie
				if cookie, err := r.Cookie("auth_token"); err == nil {
					tokenStr = cookie.Value
				}
			}

			if tokenStr != "" {
				claims, err := ValidateToken(tokenStr, secret)
				if err == nil {
					ctx := context.WithValue(r.Context(), UserContextKey, claims)
					r = r.WithContext(ctx)
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireRoles checks if the authenticated user has one of the allowed roles
func RequireRoles(ctx context.Context, allowedRoles ...string) (*Claims, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user == nil {
		return nil, errors.New("unauthorized: missing or invalid authentication")
	}

	for _, role := range allowedRoles {
		if user.Role == role {
			return user, nil
		}
	}

	return nil, errors.New("forbidden: insufficient permissions")
}
