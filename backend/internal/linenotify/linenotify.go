package linenotify

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/dof/ums-backend/internal/config"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultMulticastURL = "https://api.line.me/v2/bot/message/multicast"
	defaultPushURL      = "https://api.line.me/v2/bot/message/push"
	defaultReplyURL     = "https://api.line.me/v2/bot/message/reply"
	defaultLoadingURL   = "https://api.line.me/v2/bot/chat/loading/start"
	maxMulticastBatch   = 500
	maxLineTextRunes    = 4500
)

// LineProfile models profile data returned by LINE Messaging API Get profile endpoint.
type LineProfile struct {
	UserID        string `json:"userId"`
	DisplayName   string `json:"displayName"`
	PictureURL    string `json:"pictureUrl"`
	StatusMessage string `json:"statusMessage"`
}

// LineConnectedUser describes a UMS user associated with a connected LINE account.
type LineConnectedUser struct {
	UserID         string
	Name           string
	Role           string
	DepartmentID   string
	DepartmentName string
	IsBanned       bool
	Image          string
}

// NotificationPayload describes a notification eligible for department LINE delivery.
type NotificationPayload struct {
	ID             string
	DepartmentID   string
	DepartmentName string
	Title          string
	Message        string
	Type           string
	Severity       string
	Link           string
}

// RecipientFinder looks up LINE Messaging API user IDs (stored in account.account_id) for a department.
type RecipientFinder interface {
	FindLineAccountIDsByDepartment(ctx context.Context, departmentID string) ([]string, error)
}

type pgRecipientFinder struct {
	pool *pgxpool.Pool
}

func (f *pgRecipientFinder) FindLineAccountIDsByDepartment(ctx context.Context, departmentID string) ([]string, error) {
	if f.pool == nil || strings.TrimSpace(departmentID) == "" {
		return nil, nil
	}

	rows, err := f.pool.Query(ctx, `
		SELECT DISTINCT TRIM(a.account_id)
		FROM "account" a
		JOIN "user" u ON u.id = a.user_id
		WHERE u.department_id = $1
		  AND COALESCE(u.banned, false) = false
		  AND a.provider_id = 'line'
		  AND COALESCE(TRIM(a.account_id), '') <> ''
		ORDER BY TRIM(a.account_id)
	`, departmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if scanErr := rows.Scan(&id); scanErr == nil && id != "" {
			ids = append(ids, id)
		}
	}
	return ids, rows.Err()
}

// Service delivers department-scoped notifications via LINE Messaging API.
type Service struct {
	pool               *pgxpool.Pool
	channelAccessToken string
	channelSecret      string
	appURL             string
	finder             RecipientFinder
	httpClient         *http.Client
	multicastURL       string
	pushURL            string
	replyURL           string
	loadingURL         string
}

// NewService creates a LINE Messaging API notification service backed by PostgreSQL.
func NewService(pool *pgxpool.Pool, cfg *config.Config) *Service {
	token := ""
	secret := ""
	appURL := ""
	if cfg != nil {
		token = strings.TrimSpace(cfg.LineMessagingToken)
		secret = strings.TrimSpace(cfg.LineChannelSecret)
		appURL = strings.TrimSpace(cfg.AppURL)
	}
	return &Service{
		pool:               pool,
		channelAccessToken: token,
		channelSecret:      secret,
		appURL:             appURL,
		finder:             &pgRecipientFinder{pool: pool},
		httpClient:         &http.Client{Timeout: 10 * time.Second},
		multicastURL:       defaultMulticastURL,
		pushURL:            defaultPushURL,
		replyURL:           defaultReplyURL,
		loadingURL:         defaultLoadingURL,
	}
}

// HasChannelSecret checks whether a LINE Channel Secret is configured for HMAC verification.
func (s *Service) HasChannelSecret() bool {
	return s != nil && s.channelSecret != ""
}

// GetAppURL returns the configured base URL for deep links.
func (s *Service) GetAppURL() string {
	if s == nil {
		return ""
	}
	return s.appURL
}

// VerifySignature verifies the X-Line-Signature HMAC-SHA256 signature against the raw request body.
func (s *Service) VerifySignature(body []byte, signature string) bool {
	if s == nil || s.channelSecret == "" || signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(s.channelSecret))
	mac.Write(body)
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expected))
}

// ReplyMessage sends a text message response to LINE using replyToken.
func (s *Service) ReplyMessage(ctx context.Context, replyToken string, text string) error {
	if s == nil {
		return nil
	}
	if replyToken == "" || strings.TrimSpace(text) == "" {
		return nil
	}
	if s.channelAccessToken == "" {
		log.Printf("[LINE Bot SIMULATION - Reply] replyToken=%s text=%s", replyToken, text)
		return nil
	}
	body := map[string]any{
		"replyToken": replyToken,
		"messages": []map[string]string{
			{"type": "text", "text": truncateRunes(text, maxLineTextRunes)},
		},
	}
	return s.postJSON(ctx, s.replyURL, body)
}

// PushMessage sends an individual push text message to a specific LINE user ID.
func (s *Service) PushMessage(ctx context.Context, toUserID string, text string) error {
	if s == nil || toUserID == "" || strings.TrimSpace(text) == "" {
		return nil
	}
	if s.channelAccessToken == "" {
		log.Printf("[LINE Bot SIMULATION - Push] to=%s text=%s", toUserID, text)
		return nil
	}
	return s.sendPush(ctx, toUserID, truncateRunes(text, maxLineTextRunes))
}

// ShowLoadingAnimation displays a typing loading animation in the LINE 1-on-1 chat.
func (s *Service) ShowLoadingAnimation(ctx context.Context, chatId string, seconds int) error {
	if s == nil || s.channelAccessToken == "" || chatId == "" {
		return nil
	}
	if seconds < 5 {
		seconds = 5
	} else if seconds > 60 {
		seconds = 60
	}
	body := map[string]any{
		"chatId":         chatId,
		"loadingSeconds": seconds,
	}
	return s.postJSON(ctx, s.loadingURL, body)
}

// FindUserByLineAccountID looks up the UMS user and department info linked to a LINE account ID.
func (s *Service) FindUserByLineAccountID(ctx context.Context, accountID string) (*LineConnectedUser, error) {
	if s == nil || s.pool == nil || strings.TrimSpace(accountID) == "" {
		return nil, nil
	}
	var u LineConnectedUser
	var deptID, deptName, img *string
	err := s.pool.QueryRow(ctx, `
		SELECT u.id, u.name, u.role, u.department_id, d.full_name, COALESCE(u.banned, false), u.image
		FROM "account" a
		JOIN "user" u ON u.id = a.user_id
		LEFT JOIN departments d ON d.id = u.department_id
		WHERE a.provider_id = 'line' AND TRIM(a.account_id) = TRIM($1)
		ORDER BY a.updated_at DESC
		LIMIT 1
	`, strings.TrimSpace(accountID)).Scan(&u.UserID, &u.Name, &u.Role, &deptID, &deptName, &u.IsBanned, &img)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if deptID != nil {
		u.DepartmentID = *deptID
	}
	if deptName != nil {
		u.DepartmentName = *deptName
	}
	if img != nil {
		u.Image = *img
	}
	return &u, nil
}

// GetUserProfile fetches the LINE user profile (display name, picture URL, status message) from LINE Messaging API.
func (s *Service) GetUserProfile(ctx context.Context, lineUserID string) (*LineProfile, error) {
	cleanUID := strings.TrimSpace(lineUserID)
	if s == nil || s.channelAccessToken == "" || cleanUID == "" {
		return nil, errors.New("line service or channel token not configured")
	}

	url := fmt.Sprintf("https://api.line.me/v2/bot/profile/%s", cleanUID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.channelAccessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("line profile API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var profile LineProfile
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, err
	}
	return &profile, nil
}

// NotifyDepartment sends a notification only to non-banned users belonging to payload.DepartmentID
// who have connected their LINE account via LINE Login or Connect & Sync.
func (s *Service) NotifyDepartment(ctx context.Context, payload NotificationPayload) (int, error) {
	if s == nil {
		return 0, nil
	}
	deptID := strings.TrimSpace(payload.DepartmentID)
	if deptID == "" {
		return 0, nil
	}
	if s.finder == nil {
		return 0, nil
	}

	recipients, err := s.finder.FindLineAccountIDsByDepartment(ctx, deptID)
	if err != nil {
		log.Printf("[LINE Notify] Failed to query LINE recipients for department %s: %v", deptID, err)
		return 0, err
	}
	if len(recipients) == 0 {
		log.Printf("[LINE Notify] Skipped: no connected LINE users found for department %s (type=%s)", deptID, payload.Type)
		return 0, nil
	}

	text := FormatMessage(payload, s.appURL)

	if s.channelAccessToken == "" {
		log.Printf("==========================================")
		log.Printf("[LINE NOTIFICATION SIMULATION - NO CHANNEL ACCESS TOKEN]")
		log.Printf("Department: %s | Recipients: %d | Title: %s", deptID, len(recipients), payload.Title)
		log.Printf("==========================================")
		return 0, nil
	}

	delivered := 0
	for start := 0; start < len(recipients); start += maxMulticastBatch {
		end := start + maxMulticastBatch
		if end > len(recipients) {
			end = len(recipients)
		}
		batch := recipients[start:end]

		if err := s.sendMulticast(ctx, batch, text); err != nil {
			// If a batch has multiple recipients and fails (e.g. one invalid/unfriended ID),
			// fall back to individual pushes so valid department recipients still receive the alert.
			if len(batch) > 1 {
				for _, userID := range batch {
					if pushErr := s.sendPush(ctx, userID, text); pushErr != nil {
						log.Printf("[LINE Notify] Push failed for user %s (dept=%s): %v", userID, deptID, pushErr)
					} else {
						delivered++
					}
				}
			} else {
				log.Printf("[LINE Notify] Multicast failed for dept=%s: %v", deptID, err)
			}
		} else {
			delivered += len(batch)
		}
	}

	if delivered > 0 {
		log.Printf("[LINE Notify] Sent notification (%s) to %d/%d recipient(s) in department %s",
			payload.Type, delivered, len(recipients), deptID)
	}
	return delivered, nil
}

// NotifyDepartmentAsync dispatches NotifyDepartment in the background so API requests stay fast.
func (s *Service) NotifyDepartmentAsync(payload NotificationPayload) {
	if s == nil || strings.TrimSpace(payload.DepartmentID) == "" {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, _ = s.NotifyDepartment(ctx, payload)
	}()
}

// FormatMessage builds a concise Thai notification body suitable for LINE Messaging API.
func FormatMessage(payload NotificationPayload, appURL string) string {
	var badge string
	switch strings.ToUpper(strings.TrimSpace(payload.Severity)) {
	case "URGENT":
		badge = "🔴 [ด่วน]"
	case "WARNING":
		badge = "🟡 [เฝ้าระวัง]"
	default:
		badge = "🔵 [แจ้งเตือนหน่วยงาน]"
	}

	var b strings.Builder
	b.WriteString(badge)
	if title := strings.TrimSpace(payload.Title); title != "" {
		b.WriteString(" ")
		b.WriteString(title)
	}
	if deptName := strings.TrimSpace(payload.DepartmentName); deptName != "" {
		b.WriteString("\nหน่วยงาน: ")
		b.WriteString(deptName)
	}
	if msg := strings.TrimSpace(payload.Message); msg != "" {
		b.WriteString("\n\n")
		b.WriteString(msg)
	}
	if link := strings.TrimSpace(payload.Link); link != "" {
		fullURL := link
		if !strings.HasPrefix(link, "http://") && !strings.HasPrefix(link, "https://") && appURL != "" {
			fullURL = strings.TrimRight(appURL, "/") + "/" + strings.TrimLeft(link, "/")
		}
		b.WriteString("\n\nดูรายละเอียด: ")
		b.WriteString(fullURL)
	}

	return truncateRunes(b.String(), maxLineTextRunes)
}

func truncateRunes(s string, maxRunes int) string {
	if utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	runes := []rune(s)
	return string(runes[:maxRunes-3]) + "..."
}

func (s *Service) sendMulticast(ctx context.Context, to []string, text string) error {
	body := map[string]any{
		"to": to,
		"messages": []map[string]string{
			{"type": "text", "text": text},
		},
	}
	return s.postJSON(ctx, s.multicastURL, body)
}

func (s *Service) sendPush(ctx context.Context, to string, text string) error {
	body := map[string]any{
		"to": to,
		"messages": []map[string]string{
			{"type": "text", "text": text},
		},
	}
	return s.postJSON(ctx, s.pushURL, body)
}

func (s *Service) postJSON(ctx context.Context, endpoint string, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.channelAccessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("LINE API returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return nil
}

