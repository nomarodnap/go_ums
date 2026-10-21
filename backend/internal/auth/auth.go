package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/dof/ums-backend/internal/cache"
	"github.com/dof/ums-backend/internal/db"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/crypto/scrypt"
	"golang.org/x/text/unicode/norm"
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

// HashPassword hashes a plain password using Better Auth scrypt format (salt:keyHex)
func HashPassword(password string) (string, error) {
	saltBytes := make([]byte, 16)
	if _, err := rand.Read(saltBytes); err != nil {
		return "", err
	}
	salt := hex.EncodeToString(saltBytes)

	normalized := norm.NFKC.String(password)

	// Better Auth scrypt params: N=16384, r=16, p=1, keyLen=64
	derived, err := scrypt.Key([]byte(normalized), []byte(salt), 16384, 16, 1, 64)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s:%s", salt, hex.EncodeToString(derived)), nil
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
			normalized := norm.NFKC.String(password)
			// Better Auth scrypt params: N=16384, r=16, p=1, keyLen=64
			derived, err := scrypt.Key([]byte(normalized), []byte(salt), 16384, 16, 1, 64)
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

// AuthMiddleware creates an HTTP middleware that extracts Better Auth Session or JWT from cookies or headers
func AuthMiddleware(pool *pgxpool.Pool, redisService *cache.RedisService, secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := ""

			// 1. Check Bearer Token in Authorization header
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
			} else {
				// 2. Check Better Auth cookie (standard & secure)
				if cookie, err := r.Cookie("better-auth.session_token"); err == nil && cookie.Value != "" {
					tokenStr = cookie.Value
				} else if cookie, err := r.Cookie("__Secure-better-auth.session_token"); err == nil && cookie.Value != "" {
					tokenStr = cookie.Value
				} else if cookie, err := r.Cookie("auth_token"); err == nil && cookie.Value != "" {
					tokenStr = cookie.Value
				}
			}

			if tokenStr != "" {
				// Sanitize Better Auth signed cookie or token formats
				if strings.Contains(tokenStr, "%2E") || strings.Contains(tokenStr, "%2e") {
					tokenStr = strings.ReplaceAll(tokenStr, "%2E", ".")
					tokenStr = strings.ReplaceAll(tokenStr, "%2e", ".")
				}
				if strings.HasPrefix(tokenStr, "s:") {
					tokenStr = strings.TrimPrefix(tokenStr, "s:")
				}
				if strings.Contains(tokenStr, ".") {
					tokenStr = strings.Split(tokenStr, ".")[0]
				}
				tokenStr = strings.TrimSpace(tokenStr)

				var claims *Claims

				// A. Check Redis Cache first (for Better Auth session)
				if redisService != nil && redisService.Client != nil {
					cacheKey := "session:" + tokenStr
					if cached, err := redisService.Client.Get(r.Context(), cacheKey).Result(); err == nil && cached != "" {
						var cachedClaims Claims
						if jsonErr := json.Unmarshal([]byte(cached), &cachedClaims); jsonErr == nil {
							claims = &cachedClaims
						}
					}
				}

				// B. Check Database if not found in Redis
				if claims == nil && pool != nil {
					queries := db.New(pool)
					sessionRow, err := queries.GetSessionAndUser(r.Context(), tokenStr)
					if err == nil {
						// User must not be banned
						if !sessionRow.Banned.Valid || !sessionRow.Banned.Bool {
							var deptID string
							if sessionRow.DepartmentID.Valid {
								deptID = sessionRow.DepartmentID.String
							}
							claims = &Claims{
								UserID:       sessionRow.UserIDVal,
								Email:        sessionRow.Email,
								Name:         sessionRow.Name,
								Role:         sessionRow.Role,
								DepartmentID: deptID,
							}

							// Cache in Redis for 5 minutes
							if redisService != nil && redisService.Client != nil {
								if data, jsonErr := json.Marshal(claims); jsonErr == nil {
									_ = redisService.Client.Set(r.Context(), "session:"+tokenStr, string(data), 5*time.Minute).Err()
								}
							}
						}
					}
				}

				// C. Fallback to JWT validation (for backward compatibility)
				if claims == nil && secret != "" {
					if jwtClaims, err := ValidateToken(tokenStr, secret); err == nil {
						claims = jwtClaims
					}
				}

				// Attach user to context if authenticated
				if claims != nil {
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
