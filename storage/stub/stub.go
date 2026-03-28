package stub

import (
	"context"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/domain"
	"github.com/ydb-platform/ydb-installer/storage"
)

// Store is a placeholder Store until SQLite is implemented.
type Store struct{}

var _ storage.Store = (*Store)(nil)

func (Store) Open(ctx context.Context) error { return nil }
func (Store) Close() error                   { return nil }
func (Store) SaveSession(ctx context.Context, s *domain.InstallationSession) error {
	return domain.ErrNotImplemented
}
func (Store) LoadSession(ctx context.Context, id uuid.UUID) (*domain.InstallationSession, error) {
	return nil, domain.ErrNotImplemented
}
func (Store) ListSessions(ctx context.Context, limit, offset int) ([]domain.InstallationSession, error) {
	return nil, domain.ErrNotImplemented
}
func (Store) DeleteSession(ctx context.Context, id uuid.UUID) error {
	return domain.ErrNotImplemented
}
func (Store) SaveDiscoverySnapshot(ctx context.Context, sessionID uuid.UUID, snap *domain.DiscoverySnapshot) error {
	return domain.ErrNotImplemented
}
func (Store) LoadDiscoverySnapshot(ctx context.Context, sessionID uuid.UUID) (*domain.DiscoverySnapshot, error) {
	return nil, domain.ErrNotImplemented
}
func (Store) SaveValidationReport(ctx context.Context, sessionID uuid.UUID, r *domain.ValidationReport) error {
	return domain.ErrNotImplemented
}
func (Store) LoadValidationReport(ctx context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error) {
	return nil, domain.ErrNotImplemented
}
func (Store) SavePhaseState(ctx context.Context, sessionID uuid.UUID, phases []domain.SessionPhase) error {
	return domain.ErrNotImplemented
}
func (Store) LoadPhaseState(ctx context.Context, sessionID uuid.UUID) ([]domain.SessionPhase, error) {
	return nil, domain.ErrNotImplemented
}
