# Multi-stage Dockerfile for Go Backend
FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/ums-backend ./cmd/server

# Minimal production image
FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/ums-backend .

EXPOSE 8080
CMD ["./ums-backend"]
