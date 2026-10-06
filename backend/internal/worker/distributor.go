package worker

import (
	"context"
	"fmt"
	"log"

	"github.com/hibiken/asynq"
)

type TaskDistributor interface {
	DistributeTaskSendEmail(ctx context.Context, toEmail, toName, resetURL string, opts ...asynq.Option) error
	Close() error
}

type RedisTaskDistributor struct {
	client *asynq.Client
}

func NewRedisTaskDistributor(redisURL string) (TaskDistributor, error) {
	redisOpt, err := asynq.ParseRedisURI(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis url for asynq distributor: %w", err)
	}

	client := asynq.NewClient(redisOpt)
	return &RedisTaskDistributor{client: client}, nil
}

func (d *RedisTaskDistributor) DistributeTaskSendEmail(ctx context.Context, toEmail, toName, resetURL string, opts ...asynq.Option) error {
	task, err := NewEmailDeliveryTask(toEmail, toName, resetURL)
	if err != nil {
		return err
	}

	info, err := d.client.EnqueueContext(ctx, task, opts...)
	if err != nil {
		return fmt.Errorf("failed to enqueue email task: %w", err)
	}

	log.Printf("[Asynq] Enqueued task: type=%s, id=%s, queue=%s", info.Type, info.ID, info.Queue)
	return nil
}

func (d *RedisTaskDistributor) Close() error {
	if d.client != nil {
		return d.client.Close()
	}
	return nil
}
