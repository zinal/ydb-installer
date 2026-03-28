package stub

import (
	"context"
	"io"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/app"
	"github.com/ydb-platform/ydb-installer/domain"
)

// Services bundles placeholder implementations until real wiring exists.
type Services struct{}

var (
	_ app.SessionService       = (*Services)(nil)
	_ app.DiscoveryService     = (*Services)(nil)
	_ app.ConfigurationService = (*Services)(nil)
	_ app.ValidationService    = (*Services)(nil)
	_ app.ExecutionCoordinator = (*Services)(nil)
	_ app.ReportingService     = (*Services)(nil)
	_ app.MetadataService      = (*Services)(nil)
)

func (Services) Create(ctx context.Context, mode domain.InstallationMode, title string) (*domain.InstallationSession, error) {
	return nil, domain.ErrNotImplemented
}
func (Services) Get(ctx context.Context, id uuid.UUID) (*domain.InstallationSession, error) {
	return nil, domain.ErrNotImplemented
}
func (Services) List(ctx context.Context, limit, offset int) ([]domain.InstallationSession, error) {
	return nil, domain.ErrNotImplemented
}
func (Services) UpdateDraft(ctx context.Context, id uuid.UUID, patch app.SessionDraftPatch) error {
	return domain.ErrNotImplemented
}
func (Services) Delete(ctx context.Context, id uuid.UUID) error { return domain.ErrNotImplemented }

func (Services) SetTargets(ctx context.Context, sessionID uuid.UUID, targets []domain.TargetHost) error {
	return domain.ErrNotImplemented
}
func (Services) RunDiscovery(ctx context.Context, sessionID uuid.UUID) error {
	return domain.ErrNotImplemented
}
func (Services) GetSnapshot(ctx context.Context, sessionID uuid.UUID) (*domain.DiscoverySnapshot, error) {
	return nil, domain.ErrNotImplemented
}
func (Services) RefreshDiscovery(ctx context.Context, sessionID uuid.UUID) error {
	return domain.ErrNotImplemented
}

func (Services) GetConfiguration(ctx context.Context, sessionID uuid.UUID) (*domain.ClusterLayout, error) {
	return nil, domain.ErrNotImplemented
}
func (Services) PutConfiguration(ctx context.Context, sessionID uuid.UUID, layout domain.ClusterLayout) error {
	return domain.ErrNotImplemented
}
func (Services) ImportYAML(ctx context.Context, sessionID uuid.UUID, r io.Reader) error {
	return domain.ErrNotImplemented
}
func (Services) ImportJSON(ctx context.Context, sessionID uuid.UUID, r io.Reader) error {
	return domain.ErrNotImplemented
}
func (Services) ExportYAML(ctx context.Context, sessionID uuid.UUID, w io.Writer) error {
	return domain.ErrNotImplemented
}
func (Services) ApplyPreset(ctx context.Context, sessionID uuid.UUID, presetID string) error {
	return domain.ErrNotImplemented
}
func (Services) ListPresets(ctx context.Context) ([]app.PresetInfo, error) {
	return nil, domain.ErrNotImplemented
}

func (Services) RunPreflight(ctx context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error) {
	return nil, domain.ErrNotImplemented
}
func (Services) GetReport(ctx context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error) {
	return nil, domain.ErrNotImplemented
}

func (Services) RequestApproval(ctx context.Context, sessionID uuid.UUID) error {
	return domain.ErrNotImplemented
}
func (Services) StartExecution(ctx context.Context, sessionID uuid.UUID) error {
	return domain.ErrNotImplemented
}
func (Services) Cancel(ctx context.Context, sessionID uuid.UUID) error {
	return domain.ErrNotImplemented
}
func (Services) GetProgress(ctx context.Context, sessionID uuid.UUID) (*domain.ProgressSnapshot, error) {
	return nil, domain.ErrNotImplemented
}
func (Services) Resume(ctx context.Context, sessionID uuid.UUID) error {
	return domain.ErrNotImplemented
}

func (Services) GetCompletionReport(ctx context.Context, sessionID uuid.UUID) (*domain.CompletionReport, error) {
	return nil, domain.ErrNotImplemented
}
func (Services) ExportEffectiveSpec(ctx context.Context, sessionID uuid.UUID, w io.Writer, format string) error {
	return domain.ErrNotImplemented
}
func (Services) GetLogs(ctx context.Context, sessionID uuid.UUID, tail int) ([]string, error) {
	return nil, domain.ErrNotImplemented
}

func (Services) SupportedTopologies(ctx context.Context) ([]domain.BaseStorageTopology, error) {
	return []domain.BaseStorageTopology{
		domain.TopologyBlock42,
		domain.TopologyMirror3DC,
		domain.TopologyReducedMirror3DC,
	}, nil
}
func (Services) SupportedArtifactModes(ctx context.Context) ([]string, error) {
	return []string{"web_download", "local_archive", "local_binaries"}, nil
}
func (Services) ReferenceIndex(ctx context.Context) (map[string]string, error) {
	return map[string]string{
		"specDate": "2026-03-28",
	}, nil
}
