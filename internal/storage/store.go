package storage

import (
	"context"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/internal/domain"
)

// Store abstracts persistence (architecture §3.3). Baseline: SQLite implementation.
type Store interface {
	Open(ctx context.Context) error
	Close() error

	SaveSession(ctx context.Context, s *domain.InstallationSession) error
	LoadSession(ctx context.Context, id uuid.UUID) (*domain.InstallationSession, error)
	ListSessions(ctx context.Context, limit, offset int) ([]domain.InstallationSession, error)
	DeleteSession(ctx context.Context, id uuid.UUID) error

	SaveDiscoverySnapshot(ctx context.Context, sessionID uuid.UUID, snap *domain.DiscoverySnapshot) error
	LoadDiscoverySnapshot(ctx context.Context, sessionID uuid.UUID) (*domain.DiscoverySnapshot, error)

	SaveValidationReport(ctx context.Context, sessionID uuid.UUID, r *domain.ValidationReport) error
	LoadValidationReport(ctx context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error)

	SavePhaseState(ctx context.Context, sessionID uuid.UUID, phases []domain.SessionPhase) error
	LoadPhaseState(ctx context.Context, sessionID uuid.UUID) ([]domain.SessionPhase, error)

	// ResetAll drops all application tables and re-applies the schema (baseline: SQLite).
	ResetAll(ctx context.Context) error
}
