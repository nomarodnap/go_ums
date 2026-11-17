package linenotify

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type stubRecipientFinder struct {
	ids []string
	err error
}

func (s *stubRecipientFinder) FindLineAccountIDsByDepartment(_ context.Context, deptID string) ([]string, error) {
	if s.err != nil {
		return nil, s.err
	}
	if deptID == "" {
		return nil, nil
	}
	return s.ids, nil
}

func TestNotifyDepartmentSkipsWithoutDepartmentID(t *testing.T) {
	var called bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	svc := &Service{
		channelAccessToken: "test-token",
		appURL:             "http://localhost:3000",
		finder:             &stubRecipientFinder{ids: []string{"U-user-1"}},
		httpClient:         srv.Client(),
		multicastURL:       srv.URL + "/multicast",
		pushURL:            srv.URL + "/push",
	}

	sent, err := svc.NotifyDepartment(context.Background(), NotificationPayload{
		Title:   "Auditors only alert",
		Message: "Should not be pushed when DepartmentID is empty",
		Type:    "MANUAL_ANOMALY_EDITED",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sent != 0 || called {
		t.Fatalf("expected 0 sent and zero HTTP calls for non-department notification, got sent=%d called=%v", sent, called)
	}
}

func TestNotifyDepartmentSimulationWithoutToken(t *testing.T) {
	var called bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	svc := &Service{
		channelAccessToken: "",
		appURL:             "http://localhost:3000",
		finder:             &stubRecipientFinder{ids: []string{"U-dept-1"}},
		httpClient:         srv.Client(),
		multicastURL:       srv.URL + "/multicast",
		pushURL:            srv.URL + "/push",
	}

	sent, err := svc.NotifyDepartment(context.Background(), NotificationPayload{
		DepartmentID: "dept-1",
		Title:        "แจ้งเตือนหนี้ค้างชำระ",
		Message:      "ค้างชำระเกิน 2 เดือน",
		Severity:     "URGENT",
		Link:         "/bills/123/edit",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sent != 0 || called {
		t.Fatalf("expected simulation mode without HTTP call, got sent=%d called=%v", sent, called)
	}
}

func TestNotifyDepartmentSendsMulticastWithFormattedLink(t *testing.T) {
	var authHeader string
	var captured struct {
		To       []string            `json:"to"`
		Messages []map[string]string `json:"messages"`
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	svc := &Service{
		channelAccessToken: "line-channel-secret-token",
		appURL:             "https://ums.fisheries.go.th/",
		finder:             &stubRecipientFinder{ids: []string{"U-001", "U-002"}},
		httpClient:         srv.Client(),
		multicastURL:       srv.URL + "/multicast",
		pushURL:            srv.URL + "/push",
	}

	sent, err := svc.NotifyDepartment(context.Background(), NotificationPayload{
		DepartmentID:   "dept-north",
		DepartmentName: "ศูนย์วิจัยฯ เชียงใหม่",
		Title:          "แจ้งเตือนหนี้ค้างชำระ",
		Message:        "รายการค่าไฟยังไม่ได้ชำระเงิน",
		Type:           "PENDING_BILL",
		Severity:       "URGENT",
		Link:           "/bills/bill-9/edit",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sent != 2 {
		t.Fatalf("expected 2 delivered recipients, got %d", sent)
	}
	if authHeader != "Bearer line-channel-secret-token" {
		t.Fatalf("unexpected Authorization header: %q", authHeader)
	}
	if len(captured.To) != 2 || captured.To[0] != "U-001" || captured.To[1] != "U-002" {
		t.Fatalf("unexpected recipients: %#v", captured.To)
	}
	if len(captured.Messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(captured.Messages))
	}
	msgText := captured.Messages[0]["text"]
	if !strings.Contains(msgText, "🔴 [ด่วน]") || !strings.Contains(msgText, "https://ums.fisheries.go.th/bills/bill-9/edit") {
		t.Fatalf("formatted LINE text missing badge or URL: %q", msgText)
	}
}

func TestNotifyDepartmentFallsBackToPushOnMulticastError(t *testing.T) {
	pushed := make([]string, 0)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/multicast") {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"message":"Invalid reply/user id"}`))
			return
		}
		var body struct {
			To string `json:"to"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.To == "U-bad" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		pushed = append(pushed, body.To)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	svc := &Service{
		channelAccessToken: "line-token",
		appURL:             "http://localhost:3000",
		finder:             &stubRecipientFinder{ids: []string{"U-bad", "U-good"}},
		httpClient:         srv.Client(),
		multicastURL:       srv.URL + "/multicast",
		pushURL:            srv.URL + "/push",
	}

	sent, err := svc.NotifyDepartment(context.Background(), NotificationPayload{
		DepartmentID: "dept-1",
		Title:        "แจ้งเตือนการเบิกจ่ายล่าช้า",
		Message:      "เกิน 15 วัน",
		Severity:     "WARNING",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sent != 1 || len(pushed) != 1 || pushed[0] != "U-good" {
		t.Fatalf("expected 1 fallback push to U-good, got sent=%d pushed=%#v", sent, pushed)
	}
}

func TestVerifySignature(t *testing.T) {
	secret := "test-channel-secret-123"
	svc := &Service{
		channelSecret: secret,
	}

	body := []byte(`{"events":[{"type":"message"}]}`)
	// Compute correct signature
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	validSig := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	if !svc.VerifySignature(body, validSig) {
		t.Fatalf("expected valid signature to pass verification")
	}
	if svc.VerifySignature(body, "invalid-signature") {
		t.Fatalf("expected invalid signature to fail verification")
	}
	if svc.VerifySignature([]byte(`other body`), validSig) {
		t.Fatalf("expected altered body to fail verification")
	}
}

func TestReplyMessageAndShowLoadingAnimation(t *testing.T) {
	var replyCaptured struct {
		ReplyToken string              `json:"replyToken"`
		Messages   []map[string]string `json:"messages"`
	}
	var loadingCaptured struct {
		ChatID         string `json:"chatId"`
		LoadingSeconds int    `json:"loadingSeconds"`
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/reply") {
			_ = json.NewDecoder(r.Body).Decode(&replyCaptured)
			w.WriteHeader(http.StatusOK)
			return
		}
		if strings.HasSuffix(r.URL.Path, "/loading/start") {
			_ = json.NewDecoder(r.Body).Decode(&loadingCaptured)
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	svc := &Service{
		channelAccessToken: "valid-line-token",
		httpClient:         srv.Client(),
		replyURL:           srv.URL + "/reply",
		loadingURL:         srv.URL + "/loading/start",
	}

	if err := svc.ReplyMessage(context.Background(), "token-123", "สวัสดีครับ"); err != nil {
		t.Fatalf("unexpected reply error: %v", err)
	}
	if replyCaptured.ReplyToken != "token-123" || len(replyCaptured.Messages) != 1 || replyCaptured.Messages[0]["text"] != "สวัสดีครับ" {
		t.Fatalf("unexpected reply payload: %#v", replyCaptured)
	}

	if err := svc.ShowLoadingAnimation(context.Background(), "user-xyz", 15); err != nil {
		t.Fatalf("unexpected loading error: %v", err)
	}
	if loadingCaptured.ChatID != "user-xyz" || loadingCaptured.LoadingSeconds != 15 {
		t.Fatalf("unexpected loading payload: %#v", loadingCaptured)
	}
}

