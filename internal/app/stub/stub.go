package stub

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/internal/app"
	"github.com/ydb-platform/ydb-installer/internal/domain"
	"github.com/ydb-platform/ydb-installer/internal/storage"
)

const (
	issueConfigurationSnapshot = "stub_configuration_snapshot"
	issueRunState              = "stub_run_state"
	issueRunControl            = "stub_run_control"
	issueLogLines              = "stub_log_lines"
)

type runState struct {
	Status         string    `json:"status"`
	PhaseID        int       `json:"phaseId"`
	CurrentTask    string    `json:"currentTask,omitempty"`
	OverallPercent int       `json:"overallPercent,omitempty"`
	StartedAt      time.Time `json:"startedAt,omitempty"`
	UpdatedAt      time.Time `json:"updatedAt,omitempty"`
	ResumeEligible bool      `json:"resumeEligible,omitempty"`
}

type runControl struct {
	ResumeEligible bool `json:"resumeEligible,omitempty"`
}

type configurationDocument struct {
	Layout             domain.ClusterLayout `json:"layout"`
	PresetID           string               `json:"presetId,omitempty"`
	DatabaseName       string               `json:"databaseName,omitempty"`
	DomainPath         string               `json:"domainPath,omitempty"`
	NetworkFrontFQDN   string               `json:"networkFrontFqdn,omitempty"`
	ArtifactSourceMode string               `json:"artifactSourceMode,omitempty"`
	ArtifactVersion    string               `json:"artifactVersion,omitempty"`
}

// Services bundles placeholder implementations until real wiring exists.
// It persists mocked execution/configuration artifacts in SQLite via storage.Store.
type Services struct {
	Store storage.Store
	mu    sync.Mutex
}

func NewServices(st storage.Store) *Services {
	return &Services{Store: st}
}

var (
	_ app.SessionService       = (*Services)(nil)
	_ app.DiscoveryService     = (*Services)(nil)
	_ app.ConfigurationService = (*Services)(nil)
	_ app.ValidationService    = (*Services)(nil)
	_ app.ExecutionCoordinator = (*Services)(nil)
	_ app.ReportingService     = (*Services)(nil)
	_ app.MetadataService      = (*Services)(nil)
)

func (s *Services) Create(context.Context, domain.InstallationMode, string) (*domain.InstallationSession, error) {
	return nil, domain.ErrNotImplemented
}
func (s *Services) Get(context.Context, uuid.UUID) (*domain.InstallationSession, error) {
	return nil, domain.ErrNotImplemented
}
func (s *Services) List(context.Context, int, int) ([]domain.InstallationSession, error) {
	return nil, domain.ErrNotImplemented
}
func (s *Services) UpdateDraft(context.Context, uuid.UUID, app.SessionDraftPatch) error {
	return domain.ErrNotImplemented
}
func (s *Services) Delete(context.Context, uuid.UUID) error { return domain.ErrNotImplemented }

func (s *Services) ResetInstallationState(context.Context) error { return domain.ErrNotImplemented }

func (s *Services) SetTargets(context.Context, uuid.UUID, []domain.TargetHost) error {
	return domain.ErrNotImplemented
}
func (s *Services) RunDiscovery(context.Context, uuid.UUID) error { return domain.ErrNotImplemented }
func (s *Services) GetSnapshot(context.Context, uuid.UUID) (*domain.DiscoverySnapshot, error) {
	return nil, domain.ErrNotImplemented
}
func (s *Services) RefreshDiscovery(context.Context, uuid.UUID) error {
	return domain.ErrNotImplemented
}

func (s *Services) GetConfiguration(ctx context.Context, sessionID uuid.UUID) (*domain.ClusterLayout, error) {
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	return &state.config.Layout, nil
}

func (s *Services) PutConfiguration(ctx context.Context, sessionID uuid.UUID, layout domain.ClusterLayout) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	state.config.Layout = layout
	return s.writeState(ctx, sessionID, state)
}

func (s *Services) ImportYAML(ctx context.Context, sessionID uuid.UUID, r io.Reader) error {
	raw, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	state.config.ArtifactSourceMode = "import_yaml"
	state.config.ArtifactVersion = strings.TrimSpace(string(raw))
	return s.writeState(ctx, sessionID, state)
}

func (s *Services) ImportJSON(ctx context.Context, sessionID uuid.UUID, r io.Reader) error {
	raw, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	state.config.ArtifactSourceMode = "import_json"
	state.config.ArtifactVersion = strings.TrimSpace(string(raw))
	return s.writeState(ctx, sessionID, state)
}

func (s *Services) ExportYAML(ctx context.Context, sessionID uuid.UUID, w io.Writer) error {
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	out := fmt.Sprintf(
		"baseTopology: %s\nbridgeMode: %t\npresetId: %s\ndatabaseName: %s\ndomainPath: %s\nnetworkFrontFqdn: %s\nartifactSourceMode: %s\nartifactVersion: %s\n",
		state.config.Layout.BaseTopology,
		state.config.Layout.BridgeMode,
		state.config.PresetID,
		state.config.DatabaseName,
		state.config.DomainPath,
		state.config.NetworkFrontFQDN,
		state.config.ArtifactSourceMode,
		state.config.ArtifactVersion,
	)
	_, err = io.WriteString(w, out)
	return err
}

func (s *Services) ApplyPreset(ctx context.Context, sessionID uuid.UUID, presetID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	state.config.PresetID = presetID
	switch presetID {
	case "single-dc-block-4-2":
		state.config.Layout.BaseTopology = domain.TopologyBlock42
		state.config.Layout.BridgeMode = false
	case "multi-dc-mirror-3-dc":
		state.config.Layout.BaseTopology = domain.TopologyMirror3DC
		state.config.Layout.BridgeMode = false
	case "reduced-mirror-3-dc":
		state.config.Layout.BaseTopology = domain.TopologyReducedMirror3DC
		state.config.Layout.BridgeMode = false
	case "bridge-mode":
		state.config.Layout.BaseTopology = domain.TopologyMirror3DC
		state.config.Layout.BridgeMode = true
	}
	return s.writeState(ctx, sessionID, state)
}

func (s *Services) ListPresets(context.Context) ([]app.PresetInfo, error) {
	return []app.PresetInfo{
		{
			ID:          "single-dc-block-4-2",
			Label:       "Single-DC block-4-2",
			Description: "Preset for single datacenter deployment.",
		},
		{
			ID:          "multi-dc-mirror-3-dc",
			Label:       "Multi-DC mirror-3-dc",
			Description: "Preset for mirrored 3-DC production deployment.",
		},
		{
			ID:          "reduced-mirror-3-dc",
			Label:       "Reduced mirror-3-dc",
			Description: "Reduced-capacity 3-DC mirror preset.",
		},
		{
			ID:          "bridge-mode",
			Label:       "Bridge mode",
			Description: "Bridge-mode preset with pile topology.",
		},
	}, nil
}

func (s *Services) RunPreflight(ctx context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sess, err := s.Store.LoadSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	issues := make([]domain.ValidationIssue, 0, 2)
	valid := true
	if len(sess.Targets) == 0 {
		valid = false
		issues = append(issues, domain.ValidationIssue{
			Code:     "targets_missing",
			Severity: domain.SeverityBlocking,
			Message:  "at least one target host is required",
		})
	}
	if _, err := s.Store.LoadDiscoverySnapshot(ctx, sessionID); err != nil {
		valid = false
		issues = append(issues, domain.ValidationIssue{
			Code:     "discovery_missing",
			Severity: domain.SeverityBlocking,
			Message:  "discovery snapshot is required before review",
		})
	}
	issues = append(issues, domain.ValidationIssue{
		Code:     "stub_warning",
		Severity: domain.SeverityWarning,
		Message:  "preflight is running in stub mode; real host checks are not executed",
	})
	report := &domain.ValidationReport{
		SessionID: sessionID.String(),
		Issues:    issues,
		Valid:     valid,
	}
	now := time.Now().UTC()
	sess.Status = domain.SessionAwaitingApproval
	phase := domain.PhaseReviewApproval
	sess.Current = &phase
	sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhasePreflightValidation, domain.PhaseSucceeded, "", now)
	sess.UpdatedAt = now
	if err := s.Store.SaveSession(ctx, sess); err != nil {
		return nil, err
	}

	state.run.Status = "awaiting_approval"
	state.run.PhaseID = int(domain.PhaseReviewApproval)
	state.run.CurrentTask = "waiting for operator approval"
	state.run.UpdatedAt = now
	state.run.OverallPercent = 40
	state.run.ResumeEligible = false
	state.validation = report
	if err := s.writeState(ctx, sessionID, state); err != nil {
		return nil, err
	}
	return report, nil
}

func (s *Services) GetReport(ctx context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error) {
	rep, err := s.Store.LoadValidationReport(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	clean := *rep
	filtered := make([]domain.ValidationIssue, 0, len(rep.Issues))
	for _, issue := range rep.Issues {
		if strings.HasPrefix(issue.Code, "stub_") {
			continue
		}
		filtered = append(filtered, issue)
	}
	clean.Issues = filtered
	return &clean, nil
}

func (s *Services) RequestApproval(ctx context.Context, sessionID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	if state.validation == nil || !state.validation.Valid {
		return domain.ErrConflict
	}
	now := time.Now().UTC()
	state.run.Status = "approved"
	state.run.PhaseID = int(domain.PhaseReviewApproval)
	state.run.CurrentTask = "approval accepted"
	state.run.UpdatedAt = now
	if state.run.OverallPercent < 45 {
		state.run.OverallPercent = 45
	}
	return s.writeState(ctx, sessionID, state)
}

func (s *Services) StartExecution(ctx context.Context, sessionID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sess, err := s.Store.LoadSession(ctx, sessionID)
	if err != nil {
		return err
	}
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	if state.validation == nil || !state.validation.Valid {
		return domain.ErrConflict
	}

	now := time.Now().UTC()
	phase := domain.PhaseHostPreparation
	sess.Current = &phase
	sess.Status = domain.SessionRunning
	sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseReviewApproval, domain.PhaseSucceeded, "", now)
	sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseHostPreparation, domain.PhaseRunning, "", now)
	sess.UpdatedAt = now
	if err := s.Store.SaveSession(ctx, sess); err != nil {
		return err
	}

	state.run.Status = "running"
	state.run.PhaseID = int(domain.PhaseHostPreparation)
	state.run.CurrentTask = "prepare hosts (stub)"
	state.run.OverallPercent = 55
	state.run.StartedAt = now
	state.run.UpdatedAt = now
	state.run.ResumeEligible = false
	state.logs = append(state.logs,
		fmt.Sprintf("%s INFO execution started in stub mode", now.Format(time.RFC3339)),
		fmt.Sprintf("%s INFO phase host_preparation running", now.Format(time.RFC3339)),
	)
	return s.writeState(ctx, sessionID, state)
}

func (s *Services) Cancel(ctx context.Context, sessionID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sess, err := s.Store.LoadSession(ctx, sessionID)
	if err != nil {
		return err
	}
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	sess.Status = domain.SessionCancelRequested
	sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseHostPreparation, domain.PhaseCancelled, "cancel requested", now)
	sess.UpdatedAt = now
	if err := s.Store.SaveSession(ctx, sess); err != nil {
		return err
	}
	state.run.Status = "cancel_requested"
	state.run.PhaseID = int(domain.PhaseHostPreparation)
	state.run.CurrentTask = "waiting for safe stop (stub)"
	state.run.OverallPercent = 55
	state.run.UpdatedAt = now
	state.run.ResumeEligible = true
	state.logs = append(state.logs, fmt.Sprintf("%s WARN cancellation requested", now.Format(time.RFC3339)))
	return s.writeState(ctx, sessionID, state)
}

func (s *Services) GetProgress(ctx context.Context, sessionID uuid.UUID) (*domain.ProgressSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sess, err := s.Store.LoadSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()

	if state.run.Status == "running" {
		switch state.run.PhaseID {
		case int(domain.PhaseHostPreparation):
			state.run.PhaseID = int(domain.PhaseArtifactCertificatePrep)
			state.run.CurrentTask = "prepare artifacts and certificates (stub)"
			state.run.OverallPercent = 65
			state.run.UpdatedAt = now
			sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseHostPreparation, domain.PhaseSucceeded, "", now)
			sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseArtifactCertificatePrep, domain.PhaseRunning, "", now)
			p := domain.PhaseArtifactCertificatePrep
			sess.Current = &p
			state.logs = append(state.logs, fmt.Sprintf("%s INFO phase artifact_certificate_prep running", now.Format(time.RFC3339)))
		case int(domain.PhaseArtifactCertificatePrep):
			state.run.PhaseID = int(domain.PhaseCompletionReporting)
			state.run.CurrentTask = "finalize reports (stub)"
			state.run.OverallPercent = 90
			state.run.UpdatedAt = now
			sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseArtifactCertificatePrep, domain.PhaseSucceeded, "", now)
			sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseCompletionReporting, domain.PhaseRunning, "", now)
			p := domain.PhaseCompletionReporting
			sess.Current = &p
			state.logs = append(state.logs, fmt.Sprintf("%s INFO phase completion_reporting running", now.Format(time.RFC3339)))
		default:
			state.run.Status = "completed"
			state.run.PhaseID = int(domain.PhaseCompletionReporting)
			state.run.CurrentTask = "execution completed (stub)"
			state.run.OverallPercent = 100
			state.run.UpdatedAt = now
			state.run.ResumeEligible = false
			sess.Status = domain.SessionCompleted
			sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseCompletionReporting, domain.PhaseSucceeded, "", now)
			p := domain.PhaseCompletionReporting
			sess.Current = &p
			state.logs = append(state.logs, fmt.Sprintf("%s INFO execution completed", now.Format(time.RFC3339)))
		}
	}

	if state.run.Status == "cancel_requested" {
		state.run.Status = "cancelled"
		state.run.CurrentTask = "cancelled at safe checkpoint (stub)"
		state.run.UpdatedAt = now
		state.run.ResumeEligible = true
		sess.Status = domain.SessionCancelled
		state.logs = append(state.logs, fmt.Sprintf("%s WARN execution cancelled", now.Format(time.RFC3339)))
	}

	sess.UpdatedAt = now
	if err := s.Store.SaveSession(ctx, sess); err != nil {
		return nil, err
	}
	if err := s.writeState(ctx, sessionID, state); err != nil {
		return nil, err
	}

	elapsed := int64(0)
	if !state.run.StartedAt.IsZero() {
		elapsed = int64(now.Sub(state.run.StartedAt).Seconds())
	}
	recent := state.logs
	if len(recent) > 50 {
		recent = recent[len(recent)-50:]
	}
	return &domain.ProgressSnapshot{
		SessionID:      sessionID.String(),
		CurrentPhase:   domain.PhaseID(state.run.PhaseID),
		CurrentTask:    state.run.CurrentTask,
		ElapsedSeconds: elapsed,
		RecentLogLines: recent,
		OverallPercent: state.run.OverallPercent,
	}, nil
}

func (s *Services) Resume(ctx context.Context, sessionID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sess, err := s.Store.LoadSession(ctx, sessionID)
	if err != nil {
		return err
	}
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	if !state.run.ResumeEligible {
		return domain.ErrConflict
	}
	now := time.Now().UTC()
	state.run.Status = "running"
	state.run.PhaseID = int(domain.PhaseHostPreparation)
	state.run.CurrentTask = "resumed from checkpoint (stub)"
	state.run.UpdatedAt = now
	state.run.ResumeEligible = false
	if state.run.StartedAt.IsZero() {
		state.run.StartedAt = now
	}
	sess.Status = domain.SessionRunning
	p := domain.PhaseHostPreparation
	sess.Current = &p
	sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseHostPreparation, domain.PhaseRunning, "", now)
	sess.UpdatedAt = now
	if err := s.Store.SaveSession(ctx, sess); err != nil {
		return err
	}
	state.logs = append(state.logs, fmt.Sprintf("%s INFO execution resumed", now.Format(time.RFC3339)))
	return s.writeState(ctx, sessionID, state)
}

func (s *Services) GetCompletionReport(ctx context.Context, sessionID uuid.UUID) (*domain.CompletionReport, error) {
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	layout := string(state.config.Layout.BaseTopology)
	if layout == "" {
		layout = "stub-layout"
	}
	rep := &domain.CompletionReport{
		SessionID:           sessionID.String(),
		ClusterEndpoints:    []string{"grpc://ydb-stub.local:2135"},
		LayoutSummary:       layout,
		SecurityMode:        "stub",
		DatabaseNames:       []string{fallback(state.config.DatabaseName, "db_stub")},
		VerificationSummary: fmt.Sprintf("stub verification state: %s", state.run.Status),
		NextSteps:           "replace stub execution with real orchestration",
	}
	if state.config.Layout.BridgeMode {
		rep.BridgeSummary = "bridge mode enabled in stub configuration"
	}
	return rep, nil
}

func (s *Services) ExportEffectiveSpec(ctx context.Context, sessionID uuid.UUID, w io.Writer, format string) error {
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return err
	}
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "json":
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		return enc.Encode(state.config)
	default:
		out := fmt.Sprintf(
			"presetId: %s\nbaseTopology: %s\nbridgeMode: %t\ndatabaseName: %s\ndomainPath: %s\nnetworkFrontFqdn: %s\nartifactSourceMode: %s\nartifactVersion: %s\n",
			state.config.PresetID,
			state.config.Layout.BaseTopology,
			state.config.Layout.BridgeMode,
			state.config.DatabaseName,
			state.config.DomainPath,
			state.config.NetworkFrontFQDN,
			state.config.ArtifactSourceMode,
			state.config.ArtifactVersion,
		)
		_, err = io.WriteString(w, out)
		return err
	}
}

func (s *Services) GetLogs(ctx context.Context, sessionID uuid.UUID, tail int) ([]string, error) {
	if tail <= 0 {
		tail = 200
	}
	state, err := s.readState(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	lines := append([]string(nil), state.logs...)
	if len(lines) == 0 {
		lines = []string{
			fmt.Sprintf(
				"%s INFO run-state=%s phase=%d task=%s",
				state.run.UpdatedAt.Format(time.RFC3339),
				state.run.Status,
				state.run.PhaseID,
				fallback(state.run.CurrentTask, "n/a"),
			),
		}
	}
	if len(lines) > tail {
		lines = lines[len(lines)-tail:]
	}
	return lines, nil
}

func (s *Services) SupportedTopologies(context.Context) ([]domain.BaseStorageTopology, error) {
	return []domain.BaseStorageTopology{
		domain.TopologyBlock42,
		domain.TopologyMirror3DC,
		domain.TopologyReducedMirror3DC,
	}, nil
}

func (s *Services) SupportedArtifactModes(context.Context) ([]string, error) {
	return []string{"download", "local-archive", "local-binaries", "mirror"}, nil
}

func (s *Services) ReferenceIndex(context.Context) (map[string]string, error) {
	return map[string]string{
		"specDate": "2026-03-28",
	}, nil
}

type aggregateState struct {
	config     configurationDocument
	run        runState
	logs       []string
	validation *domain.ValidationReport
}

func (s *Services) readState(ctx context.Context, sessionID uuid.UUID) (aggregateState, error) {
	state := aggregateState{
		config: configurationDocument{
			Layout: domain.ClusterLayout{
				BaseTopology: domain.TopologyBlock42,
			},
		},
		run: runState{
			Status:         "idle",
			PhaseID:        int(domain.PhaseReviewApproval),
			CurrentTask:    "ready",
			OverallPercent: 0,
			UpdatedAt:      time.Now().UTC(),
		},
		logs: nil,
	}
	rep, err := s.Store.LoadValidationReport(ctx, sessionID)
	if err != nil {
		if err == domain.ErrNotFound {
			return state, nil
		}
		return aggregateState{}, err
	}
	if len(rep.Issues) == 0 {
		state.validation = rep
		return state, nil
	}
	nonStubIssues := make([]domain.ValidationIssue, 0, len(rep.Issues))
	for _, issue := range rep.Issues {
		switch issue.Code {
		case issueConfigurationSnapshot:
			_ = json.Unmarshal([]byte(issue.Message), &state.config)
		case issueRunState:
			_ = json.Unmarshal([]byte(issue.Message), &state.run)
		case issueRunControl:
			var ctl runControl
			if json.Unmarshal([]byte(issue.Message), &ctl) == nil {
				state.run.ResumeEligible = ctl.ResumeEligible
			}
		case issueLogLines:
			_ = json.Unmarshal([]byte(issue.Message), &state.logs)
		default:
			nonStubIssues = append(nonStubIssues, issue)
		}
	}
	state.validation = &domain.ValidationReport{
		SessionID: fallback(rep.SessionID, sessionID.String()),
		Valid:     rep.Valid,
		Issues:    nonStubIssues,
	}
	return state, nil
}

func (s *Services) writeState(ctx context.Context, sessionID uuid.UUID, state aggregateState) error {
	issues := make([]domain.ValidationIssue, 0, 4+len(state.validationIssues()))
	issues = append(issues,
		domain.ValidationIssue{
			Code:      issueConfigurationSnapshot,
			Severity:  domain.SeverityInfo,
			Message:   mustJSON(state.config),
			PhaseHint: "configuration",
		},
		domain.ValidationIssue{
			Code:      issueRunState,
			Severity:  domain.SeverityInfo,
			Message:   mustJSON(state.run),
			PhaseHint: "run_state",
		},
		domain.ValidationIssue{
			Code:      issueRunControl,
			Severity:  domain.SeverityInfo,
			Message:   mustJSON(runControl{ResumeEligible: state.run.ResumeEligible}),
			PhaseHint: "run_state",
		},
		domain.ValidationIssue{
			Code:      issueLogLines,
			Severity:  domain.SeverityInfo,
			Message:   mustJSON(state.logs),
			PhaseHint: "logging",
		},
	)
	issues = append(issues, state.validationIssues()...)
	valid := true
	if state.validation != nil {
		valid = state.validation.Valid
	}
	report := &domain.ValidationReport{
		SessionID: sessionID.String(),
		Valid:     valid,
		Issues:    issues,
	}
	return s.Store.SaveValidationReport(ctx, sessionID, report)
}

func (s aggregateState) validationIssues() []domain.ValidationIssue {
	if s.validation == nil {
		return nil
	}
	out := make([]domain.ValidationIssue, 0, len(s.validation.Issues))
	for _, issue := range s.validation.Issues {
		if strings.HasPrefix(issue.Code, "stub_") {
			continue
		}
		out = append(out, issue)
	}
	return out
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func fallback(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}
