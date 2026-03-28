package execution

import (
	"context"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/domain"
)

// Engine is the persisted phase/task runner (architecture §3.6).
type Engine interface {
	EnqueueSession(ctx context.Context, sessionID uuid.UUID) error
	PauseAtCheckpoint(ctx context.Context, sessionID uuid.UUID) error
	CurrentPhase(ctx context.Context, sessionID uuid.UUID) (domain.PhaseID, error)
	ListTasks(ctx context.Context, sessionID uuid.UUID) ([]domain.ExecutionTask, error)
	SubscribeProgress(ctx context.Context, sessionID uuid.UUID) (<-chan domain.ProgressSnapshot, func(), error)
}
