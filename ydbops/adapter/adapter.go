package adapter

import (
	"context"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/domain"
)

// Deployment exposes ydbops-aligned operations to embed or wrap (architecture §3.7).
type Deployment interface {
	PrepareHosts(ctx context.Context, sessionID uuid.UUID) error
	PrepareArtifactsAndCerts(ctx context.Context, sessionID uuid.UUID) error
	InstallStorageNodes(ctx context.Context, sessionID uuid.UUID) error
	InitializeStorage(ctx context.Context, sessionID uuid.UUID) error
	ConfigureBridge(ctx context.Context, sessionID uuid.UUID) error
	CreateDatabase(ctx context.Context, sessionID uuid.UUID) error
	InstallComputeNodes(ctx context.Context, sessionID uuid.UUID) error
	VerifyCluster(ctx context.Context, sessionID uuid.UUID) error
}

// EventSink receives structured events from deployment steps for persistence.
type EventSink interface {
	OnTaskStart(ctx context.Context, sessionID uuid.UUID, phase domain.PhaseID, name string) error
	OnTaskEnd(ctx context.Context, sessionID uuid.UUID, phase domain.PhaseID, name string, err error) error
}
