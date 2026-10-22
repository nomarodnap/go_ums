package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SSEEvent represents a message sent to connected web clients
type SSEEvent struct {
	Channel string          `json:"channel"`
	Payload json.RawMessage `json:"payload"`
}

// Hub manages SSE clients and listens to PostgreSQL LISTEN/NOTIFY
type Hub struct {
	pool      *pgxpool.Pool
	directURL string
	clientsMu sync.RWMutex
	clients   map[chan SSEEvent]bool
	cancel    context.CancelFunc
}

// NewHub initializes the Realtime Event Hub
func NewHub(pool *pgxpool.Pool, directURL string) *Hub {
	return &Hub{
		pool:      pool,
		directURL: directURL,
		clients:   make(map[chan SSEEvent]bool),
	}
}

// Start begins listening to PostgreSQL NOTIFY channels using a dedicated connection
func (h *Hub) Start(ctx context.Context) {
	listenCtx, cancel := context.WithCancel(ctx)
	h.cancel = cancel

	go h.listenLoop(listenCtx)
	log.Println("[Realtime Hub] Started Postgres LISTEN/NOTIFY listener.")
}

func (h *Hub) listenLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		conn, err := pgx.Connect(ctx, h.directURL)
		if err != nil {
			log.Printf("[Realtime Hub] Warning: Failed to connect dedicated listener to DIRECT_URL: %v. Retrying in 5s...", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(5 * time.Second):
				continue
			}
		}

		// Listen on application channels
		channels := []string{"notifications", "bills", "system"}
		for _, ch := range channels {
			if _, err := conn.Exec(ctx, fmt.Sprintf("LISTEN %s", ch)); err != nil {
				log.Printf("[Realtime Hub] Failed to LISTEN on channel %s: %v", ch, err)
			}
		}
		log.Printf("[Realtime Hub] Listening for PostgreSQL notifications on: %v", channels)

		for {
			notification, err := conn.WaitForNotification(ctx)
			if err != nil {
				log.Printf("[Realtime Hub] Notification listener disconnected: %v. Reconnecting...", err)
				_ = conn.Close(ctx)
				break
			}

			// Broadcast received event to all connected SSE clients
			h.broadcast(SSEEvent{
				Channel: notification.Channel,
				Payload: json.RawMessage(notification.Payload),
			})
		}
	}
}

// Publish sends a notification to PostgreSQL LISTEN/NOTIFY
func (h *Hub) Publish(ctx context.Context, channel string, payload any) error {
	var data []byte
	var err error

	switch v := payload.(type) {
	case string:
		data = []byte(v)
	case []byte:
		data = v
	default:
		data, err = json.Marshal(v)
		if err != nil {
			return fmt.Errorf("failed to marshal payload: %w", err)
		}
	}

	if h.pool == nil {
		return fmt.Errorf("db pool is nil")
	}

	_, err = h.pool.Exec(ctx, "SELECT pg_notify($1, $2)", channel, string(data))
	return err
}

func (h *Hub) broadcast(event SSEEvent) {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()

	for clientChan := range h.clients {
		select {
		case clientChan <- event:
		default:
			// Client buffer full, skip to prevent blocking
		}
	}
}

// Subscribe adds an SSE client channel
func (h *Hub) Subscribe() chan SSEEvent {
	ch := make(chan SSEEvent, 64)
	h.clientsMu.Lock()
	h.clients[ch] = true
	h.clientsMu.Unlock()
	return ch
}

// Unsubscribe removes an SSE client channel
func (h *Hub) Unsubscribe(ch chan SSEEvent) {
	h.clientsMu.Lock()
	delete(h.clients, ch)
	h.clientsMu.Unlock()
	close(ch)
}

// Stop terminates the hub listener
func (h *Hub) Stop() {
	if h.cancel != nil {
		h.cancel()
	}
}

// RegisterRoutes mounts the SSE endpoint onto Chi router
func RegisterRoutes(router chi.Router, hub *Hub) {
	router.Get("/api/events", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no") // Disable Nginx proxy buffering for SSE

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
			return
		}

		// Initial connection handshake
		_, _ = fmt.Fprintf(w, ": connected\n\n")
		flusher.Flush()

		clientChan := hub.Subscribe()
		defer hub.Unsubscribe(clientChan)

		heartbeat := time.NewTicker(15 * time.Second)
		defer heartbeat.Stop()

		for {
			select {
			case <-r.Context().Done():
				return
			case <-heartbeat.C:
				_, _ = fmt.Fprintf(w, ": heartbeat\n\n")
				flusher.Flush()
			case event := <-clientChan:
				_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Channel, string(event.Payload))
				flusher.Flush()
			}
		}
	})
}
