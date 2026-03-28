package app

import (
	"context"
	"io"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/domain"
)

// SessionService owns installation session lifecycle (FR-API-002).
type SessionService interface {
	Create(ctx context.Context, mode domain.InstallationMode, title string) (*domain.InstallationSession, error)
	Get(ctx context.Context, id uuid.UUID) (*domain.InstallationSession, error)
	List(ctx context.Context, limit, offset int) ([]domain.InstallationSession, error)
	UpdateDraft(ctx context.Context, id uuid.UUID, patch SessionDraftPatch) error
	Delete(ctx context.Context, id uuid.UUID) error
}

// SessionDraftPatch is a partial update for autosave (FR-USABILITY-004).
type SessionDraftPatch struct {
	Title *string `json:"title,omitempty"`
}

// DiscoveryService runs inventory collection (§5).
type DiscoveryService interface {
	SetTargets(ctx context.Context, sessionID uuid.UUID, targets []domain.TargetHost) error
	RunDiscovery(ctx context.Context, sessionID uuid.UUID) error
	GetSnapshot(ctx context.Context, sessionID uuid.UUID) (*domain.DiscoverySnapshot, error)
	RefreshDiscovery(ctx context.Context, sessionID uuid.UUID) error
}

// ConfigurationService manages cluster config import/export (§6–9, FR-BATCH-003).
type ConfigurationService interface {
	GetConfiguration(ctx context.Context, sessionID uuid.UUID) (*domain.ClusterLayout, error)
	PutConfiguration(ctx context.Context, sessionID uuid.UUID, layout domain.ClusterLayout) error
	ImportYAML(ctx context.Context, sessionID uuid.UUID, r io.Reader) error
	ImportJSON(ctx context.Context, sessionID uuid.UUID, r io.Reader) error
	ExportYAML(ctx context.Context, sessionID uuid.UUID, w io.Writer) error
	ApplyPreset(ctx context.Context, sessionID uuid.UUID, presetID string) error
	ListPresets(ctx context.Context) ([]PresetInfo, error)
}

// PresetInfo for FR-INTERACTIVE-007.
type PresetInfo struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
}

// ValidationService runs preflight checks (§12).
type ValidationService interface {
	RunPreflight(ctx context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error)
	GetReport(ctx context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error)
}

// ExecutionCoordinator starts and monitors runs (§13–15).
type ExecutionCoordinator interface {
	RequestApproval(ctx context.Context, sessionID uuid.UUID) error
	StartExecution(ctx context.Context, sessionID uuid.UUID) error
	Cancel(ctx context.Context, sessionID uuid.UUID) error
	GetProgress(ctx context.Context, sessionID uuid.UUID) (*domain.ProgressSnapshot, error)
	Resume(ctx context.Context, sessionID uuid.UUID) error
}

// ReportingService persists and retrieves reports and exports (§16).
type ReportingService interface {
	GetCompletionReport(ctx context.Context, sessionID uuid.UUID) (*domain.CompletionReport, error)
	ExportEffectiveSpec(ctx context.Context, sessionID uuid.UUID, w io.Writer, format string) error
	GetLogs(ctx context.Context, sessionID uuid.UUID, tail int) ([]string, error)
}

// MetadataService exposes presets, options, and reference data for the UI (FR-API-002).
type MetadataService interface {
	SupportedTopologies(ctx context.Context) ([]domain.BaseStorageTopology, error)
	SupportedArtifactModes(ctx context.Context) ([]string, error)
	ReferenceIndex(ctx context.Context) (map[string]string, error)
}
