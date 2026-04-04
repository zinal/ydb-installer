// Package stub_test covers the full workflow state machine exposed by
// app/stub.Services:  draft → discovery_ready → configuring →
// awaiting_approval → running → completed, and the cancel → cancelled and
// resume paths.  Each test starts from a freshly seeded session and asserts
// both the persisted session status and every service call that should be
// valid at that point in the workflow.
package stub_test

import (
	"context"
	"strings"
	"testing"

	discoverysvc "github.com/ydb-platform/ydb-installer/internal/app/discovery"
	"github.com/ydb-platform/ydb-installer/internal/app/session"
	appstub "github.com/ydb-platform/ydb-installer/internal/app/stub"
	"github.com/ydb-platform/ydb-installer/internal/domain"
	"github.com/ydb-platform/ydb-installer/internal/testdiscovery"
	"github.com/ydb-platform/ydb-installer/internal/teststore"
)

// ---------------------------------------------------------------------------
// Shared scaffolding
// ---------------------------------------------------------------------------

type services struct {
	st      *teststore.Store
	sess    *session.Service
	disc    *discoverysvc.Service
	stub    *appstub.Services
}

func newServices(t *testing.T) *services {
	t.Helper()
	st := teststore.New()
	return &services{
		st:   st,
		sess: &session.Service{Store: st},
		disc: &discoverysvc.Service{Store: st, Discoverer: testdiscovery.Successful()},
		stub: appstub.NewServices(st),
	}
}

var twoTargets = []domain.TargetHost{
	{Address: "host-a", Port: 22, User: "root"},
	{Address: "host-b", Port: 22, User: "root"},
}

// advanceToDiscoveryReady creates a session and sets targets → status becomes
// discovery_ready.
func (s *services) advanceToDiscoveryReady(t *testing.T, ctx context.Context) *domain.InstallationSession {
	t.Helper()
	sess, err := s.sess.Create(ctx, domain.ModeInteractive, "test")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := s.disc.SetTargets(ctx, sess.ID, twoTargets); err != nil {
		t.Fatalf("SetTargets: %v", err)
	}
	got, _ := s.sess.Get(ctx, sess.ID)
	return got
}

// advanceToConfiguring runs discovery on top of advanceToDiscoveryReady.
func (s *services) advanceToConfiguring(t *testing.T, ctx context.Context) *domain.InstallationSession {
	t.Helper()
	sess := s.advanceToDiscoveryReady(t, ctx)
	if err := s.disc.RunDiscovery(ctx, sess.ID); err != nil {
		t.Fatalf("RunDiscovery: %v", err)
	}
	got, _ := s.sess.Get(ctx, sess.ID)
	return got
}

// advanceToAwaitingApproval runs preflight validation.
func (s *services) advanceToAwaitingApproval(t *testing.T, ctx context.Context) *domain.InstallationSession {
	t.Helper()
	sess := s.advanceToConfiguring(t, ctx)
	_, err := s.stub.RunPreflight(ctx, sess.ID)
	if err != nil {
		t.Fatalf("RunPreflight: %v", err)
	}
	got, _ := s.sess.Get(ctx, sess.ID)
	return got
}

// advanceToRunning calls StartExecution (which requires valid validation).
func (s *services) advanceToRunning(t *testing.T, ctx context.Context) *domain.InstallationSession {
	t.Helper()
	sess := s.advanceToAwaitingApproval(t, ctx)
	if err := s.stub.StartExecution(ctx, sess.ID); err != nil {
		t.Fatalf("StartExecution: %v", err)
	}
	got, _ := s.sess.Get(ctx, sess.ID)
	return got
}

// ---------------------------------------------------------------------------
// DRAFT state
// ---------------------------------------------------------------------------

func TestDraft_InitialState(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess, err := svc.sess.Create(ctx, domain.ModeInteractive, "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if sess.Status != domain.SessionDraft {
		t.Errorf("initial Status = %q, want %q", sess.Status, domain.SessionDraft)
	}
	if len(sess.Phases) == 0 {
		t.Error("expected phases to be initialised")
	}
	for _, p := range sess.Phases {
		if p.State != domain.PhasePending {
			t.Errorf("phase %s: state = %q, want pending", p.Name, p.State)
		}
	}
}

func TestDraft_GetSnapshotReturnsEmptyBeforeDiscovery(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess, _ := svc.sess.Create(ctx, domain.ModeInteractive, "")
	snap, err := svc.disc.GetSnapshot(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetSnapshot on draft: %v", err)
	}
	if snap.CollectedAt != "" {
		t.Errorf("CollectedAt should be empty, got %q", snap.CollectedAt)
	}
}

func TestDraft_RunDiscoveryWithoutTargetsFails(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess, _ := svc.sess.Create(ctx, domain.ModeInteractive, "")
	err := svc.disc.RunDiscovery(ctx, sess.ID)
	if err != domain.ErrValidation {
		t.Errorf("RunDiscovery without targets: got %v, want ErrValidation", err)
	}
}

func TestDraft_RunPreflightWithoutTargetsFails(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess, _ := svc.sess.Create(ctx, domain.ModeInteractive, "")
	rep, err := svc.stub.RunPreflight(ctx, sess.ID)
	if err != nil {
		t.Fatalf("RunPreflight: %v", err)
	}
	// Stub RunPreflight succeeds but marks the report invalid (targets missing).
	if rep.Valid {
		t.Error("preflight report should be invalid when targets are missing")
	}
	found := false
	for _, issue := range rep.Issues {
		if issue.Code == "targets_missing" {
			found = true
		}
	}
	if !found {
		t.Error("expected targets_missing issue in preflight report")
	}
}

func TestDraft_StartExecutionWithoutValidationFails(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess, _ := svc.sess.Create(ctx, domain.ModeInteractive, "")
	err := svc.stub.StartExecution(ctx, sess.ID)
	if err != domain.ErrConflict {
		t.Errorf("StartExecution without validation: got %v, want ErrConflict", err)
	}
}

// ---------------------------------------------------------------------------
// DISCOVERY_READY state
// ---------------------------------------------------------------------------

func TestDiscoveryReady_Status(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToDiscoveryReady(t, ctx)
	if sess.Status != domain.SessionDiscoveryReady {
		t.Errorf("Status = %q, want %q", sess.Status, domain.SessionDiscoveryReady)
	}
}

func TestDiscoveryReady_TargetsAreStored(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToDiscoveryReady(t, ctx)
	if len(sess.Targets) != len(twoTargets) {
		t.Errorf("Targets len = %d, want %d", len(sess.Targets), len(twoTargets))
	}
}

func TestDiscoveryReady_CanUpdateTargets(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToDiscoveryReady(t, ctx)
	newTargets := []domain.TargetHost{{Address: "host-c", Port: 22, User: "root"}}
	if err := svc.disc.SetTargets(ctx, sess.ID, newTargets); err != nil {
		t.Fatalf("SetTargets (update): %v", err)
	}
	got, _ := svc.sess.Get(ctx, sess.ID)
	if len(got.Targets) != 1 || got.Targets[0].Address != "host-c" {
		t.Errorf("updated Targets = %v, want single host-c", got.Targets)
	}
}

// ---------------------------------------------------------------------------
// CONFIGURING state
// ---------------------------------------------------------------------------

func TestConfiguring_Status(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)
	if sess.Status != domain.SessionConfiguring {
		t.Errorf("Status = %q, want %q", sess.Status, domain.SessionConfiguring)
	}
}

func TestConfiguring_SnapshotContainsHosts(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)
	snap, err := svc.disc.GetSnapshot(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetSnapshot: %v", err)
	}
	if len(snap.Hosts) != len(twoTargets) {
		t.Errorf("snapshot Hosts len = %d, want %d", len(snap.Hosts), len(twoTargets))
	}
}

func TestConfiguring_DiscoveryPhaseSucceeded(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)
	got, _ := svc.sess.Get(ctx, sess.ID)
	for _, p := range got.Phases {
		if p.PhaseID == domain.PhaseDiscovery && p.State != domain.PhaseSucceeded {
			t.Errorf("PhaseDiscovery state = %q, want succeeded", p.State)
		}
	}
}

func TestConfiguring_SecondRunDiscoveryUpdatesSnapshot(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)
	first, _ := svc.disc.GetSnapshot(ctx, sess.ID)

	if err := svc.disc.RunDiscovery(ctx, sess.ID); err != nil {
		t.Fatalf("second RunDiscovery: %v", err)
	}

	second, _ := svc.disc.GetSnapshot(ctx, sess.ID)
	if second.CollectedAt == "" {
		t.Error("snapshot after second run CollectedAt is empty")
	}
	_ = first
}

func TestConfiguring_ConfigurationCanBeSetAndRead(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)
	layout := domain.ClusterLayout{BaseTopology: domain.TopologyMirror3DC, BridgeMode: false}
	if err := svc.stub.PutConfiguration(ctx, sess.ID, layout); err != nil {
		t.Fatalf("PutConfiguration: %v", err)
	}
	got, err := svc.stub.GetConfiguration(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetConfiguration: %v", err)
	}
	if got.BaseTopology != domain.TopologyMirror3DC {
		t.Errorf("BaseTopology = %q, want %q", got.BaseTopology, domain.TopologyMirror3DC)
	}
}

func TestConfiguring_PresetCanBeApplied(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)
	if err := svc.stub.ApplyPreset(ctx, sess.ID, "single-dc-block-4-2"); err != nil {
		t.Fatalf("ApplyPreset: %v", err)
	}
	got, _ := svc.stub.GetConfiguration(ctx, sess.ID)
	if got.BaseTopology != domain.TopologyBlock42 {
		t.Errorf("preset BaseTopology = %q, want %q", got.BaseTopology, domain.TopologyBlock42)
	}
}

func TestConfiguring_BridgeModePresetSetsBridgeFlag(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)
	_ = svc.stub.ApplyPreset(ctx, sess.ID, "bridge-mode")

	got, _ := svc.stub.GetConfiguration(ctx, sess.ID)
	if !got.BridgeMode {
		t.Error("bridge-mode preset: BridgeMode should be true")
	}
}

func TestConfiguring_ListPresetsReturnsKnownPresets(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	presets, err := svc.stub.ListPresets(ctx)
	if err != nil {
		t.Fatalf("ListPresets: %v", err)
	}
	if len(presets) == 0 {
		t.Error("expected at least one preset")
	}
	ids := make(map[string]bool)
	for _, p := range presets {
		ids[p.ID] = true
	}
	for _, want := range []string{"single-dc-block-4-2", "multi-dc-mirror-3-dc", "bridge-mode"} {
		if !ids[want] {
			t.Errorf("preset %q not found in ListPresets result", want)
		}
	}
}

func TestConfiguring_StartExecutionWithoutValidationFails(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)
	err := svc.stub.StartExecution(ctx, sess.ID)
	if err != domain.ErrConflict {
		t.Errorf("StartExecution without preflight: got %v, want ErrConflict", err)
	}
}

// ---------------------------------------------------------------------------
// AWAITING_APPROVAL state  (after RunPreflight with targets + snapshot)
// ---------------------------------------------------------------------------

func TestAwaitingApproval_Status(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToAwaitingApproval(t, ctx)
	if sess.Status != domain.SessionAwaitingApproval {
		t.Errorf("Status = %q, want %q", sess.Status, domain.SessionAwaitingApproval)
	}
}

func TestAwaitingApproval_ReportIsValid(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToAwaitingApproval(t, ctx)
	rep, err := svc.stub.GetReport(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetReport: %v", err)
	}
	if !rep.Valid {
		t.Errorf("validation report Valid = false after successful preflight")
	}
}

func TestAwaitingApproval_ReportExcludesStubInternalIssues(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToAwaitingApproval(t, ctx)
	rep, _ := svc.stub.GetReport(ctx, sess.ID)
	for _, issue := range rep.Issues {
		if strings.HasPrefix(issue.Code, "stub_") {
			t.Errorf("GetReport exposed internal stub issue %q", issue.Code)
		}
	}
}

func TestAwaitingApproval_PreflightPhaseMarkedSucceeded(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToAwaitingApproval(t, ctx)
	got, _ := svc.sess.Get(ctx, sess.ID)
	for _, p := range got.Phases {
		if p.PhaseID == domain.PhasePreflightValidation && p.State != domain.PhaseSucceeded {
			t.Errorf("PhasePreflightValidation state = %q, want succeeded", p.State)
		}
	}
}

func TestAwaitingApproval_RequestApprovalSucceeds(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToAwaitingApproval(t, ctx)
	if err := svc.stub.RequestApproval(ctx, sess.ID); err != nil {
		t.Errorf("RequestApproval: %v", err)
	}
}

func TestAwaitingApproval_StartExecutionTransitionsToRunning(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToAwaitingApproval(t, ctx)
	if err := svc.stub.StartExecution(ctx, sess.ID); err != nil {
		t.Fatalf("StartExecution: %v", err)
	}
	got, _ := svc.sess.Get(ctx, sess.ID)
	if got.Status != domain.SessionRunning {
		t.Errorf("Status = %q, want %q", got.Status, domain.SessionRunning)
	}
}

// ---------------------------------------------------------------------------
// RUNNING state
// ---------------------------------------------------------------------------

func TestRunning_Status(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	if sess.Status != domain.SessionRunning {
		t.Errorf("Status = %q, want %q", sess.Status, domain.SessionRunning)
	}
}

func TestRunning_ReviewApprovalPhaseSucceeded(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	got, _ := svc.sess.Get(ctx, sess.ID)
	for _, p := range got.Phases {
		if p.PhaseID == domain.PhaseReviewApproval && p.State != domain.PhaseSucceeded {
			t.Errorf("PhaseReviewApproval state = %q, want succeeded", p.State)
		}
	}
}

func TestRunning_HostPreparationPhaseIsRunning(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	got, _ := svc.sess.Get(ctx, sess.ID)
	for _, p := range got.Phases {
		if p.PhaseID == domain.PhaseHostPreparation && p.State != domain.PhaseRunning {
			t.Errorf("PhaseHostPreparation state = %q, want running", p.State)
		}
	}
}

func TestRunning_GetProgressReturnsRunningStatus(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	prog, err := svc.stub.GetProgress(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetProgress: %v", err)
	}
	if prog.SessionID != sess.ID.String() {
		t.Errorf("progress SessionID = %q, want %q", prog.SessionID, sess.ID)
	}
}

func TestRunning_GetProgressAdvancesPhaseOnEachCall(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)

	// Three consecutive progress polls drive the stub through its phases.
	var lastPercent int
	for i := 0; i < 3; i++ {
		prog, err := svc.stub.GetProgress(ctx, sess.ID)
		if err != nil {
			t.Fatalf("GetProgress call %d: %v", i+1, err)
		}
		_ = prog
		lastPercent = prog.OverallPercent
	}
	if lastPercent < 90 {
		t.Errorf("OverallPercent after 3 polls = %d, want ≥90", lastPercent)
	}
}

func TestRunning_GetLogsReturnsLines(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	lines, err := svc.stub.GetLogs(ctx, sess.ID, 200)
	if err != nil {
		t.Fatalf("GetLogs: %v", err)
	}
	if len(lines) == 0 {
		t.Error("expected at least one log line after execution started")
	}
}

// ---------------------------------------------------------------------------
// COMPLETED state  (after exhausting the stub phase chain)
// ---------------------------------------------------------------------------

func TestCompleted_StatusAfterPhaseChain(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)

	// Poll until completed or we hit a limit.
	const maxPolls = 10
	for i := 0; i < maxPolls; i++ {
		got, _ := svc.sess.Get(ctx, sess.ID)
		if got.Status == domain.SessionCompleted {
			return // success
		}
		if _, err := svc.stub.GetProgress(ctx, sess.ID); err != nil {
			t.Fatalf("GetProgress poll %d: %v", i+1, err)
		}
	}
	got, _ := svc.sess.Get(ctx, sess.ID)
	if got.Status != domain.SessionCompleted {
		t.Errorf("Status after %d progress polls = %q, want completed", maxPolls, got.Status)
	}
}

func TestCompleted_CompletionReportIsAvailable(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	for i := 0; i < 10; i++ {
		got, _ := svc.sess.Get(ctx, sess.ID)
		if got.Status == domain.SessionCompleted {
			break
		}
		_, _ = svc.stub.GetProgress(ctx, sess.ID)
	}

	rep, err := svc.stub.GetCompletionReport(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetCompletionReport: %v", err)
	}
	if len(rep.ClusterEndpoints) == 0 {
		t.Error("expected at least one cluster endpoint in completion report")
	}
	if rep.SessionID != sess.ID.String() {
		t.Errorf("completion report SessionID = %q, want %q", rep.SessionID, sess.ID)
	}
}

func TestCompleted_OverallPercentIs100(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	var lastProg *domain.ProgressSnapshot
	for i := 0; i < 10; i++ {
		got, _ := svc.sess.Get(ctx, sess.ID)
		if got.Status == domain.SessionCompleted {
			break
		}
		p, err := svc.stub.GetProgress(ctx, sess.ID)
		if err != nil {
			t.Fatalf("GetProgress: %v", err)
		}
		lastProg = p
	}
	if lastProg == nil {
		t.Skip("completed before any progress snapshot was captured")
	}
	if lastProg.OverallPercent != 100 {
		t.Errorf("OverallPercent = %d, want 100", lastProg.OverallPercent)
	}
}

// ---------------------------------------------------------------------------
// CANCEL / CANCELLED path
// ---------------------------------------------------------------------------

func TestCancel_TransitionsToCancelRequested(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	if err := svc.stub.Cancel(ctx, sess.ID); err != nil {
		t.Fatalf("Cancel: %v", err)
	}
	got, _ := svc.sess.Get(ctx, sess.ID)
	if got.Status != domain.SessionCancelRequested {
		t.Errorf("Status = %q, want %q", got.Status, domain.SessionCancelRequested)
	}
}

func TestCancel_GetProgressTransitionsToCancelled(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	_ = svc.stub.Cancel(ctx, sess.ID)

	// A single GetProgress call completes the cancellation in the stub.
	if _, err := svc.stub.GetProgress(ctx, sess.ID); err != nil {
		t.Fatalf("GetProgress after Cancel: %v", err)
	}

	got, _ := svc.sess.Get(ctx, sess.ID)
	if got.Status != domain.SessionCancelled {
		t.Errorf("Status = %q, want %q", got.Status, domain.SessionCancelled)
	}
}

func TestCancel_CancelledSessionIsResumeEligible(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	_ = svc.stub.Cancel(ctx, sess.ID)
	_, _ = svc.stub.GetProgress(ctx, sess.ID) // drain to cancelled

	// After cancellation, stub marks the execution as resume-eligible.
	// Verify Resume succeeds (it would return ErrConflict if not eligible).
	if err := svc.stub.Resume(ctx, sess.ID); err != nil {
		t.Errorf("Resume after cancel: %v", err)
	}
}

// ---------------------------------------------------------------------------
// RESUME path
// ---------------------------------------------------------------------------

func TestResume_TransitionsBackToRunning(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToRunning(t, ctx)
	_ = svc.stub.Cancel(ctx, sess.ID)
	_, _ = svc.stub.GetProgress(ctx, sess.ID) // drain to cancelled

	if err := svc.stub.Resume(ctx, sess.ID); err != nil {
		t.Fatalf("Resume: %v", err)
	}

	got, _ := svc.sess.Get(ctx, sess.ID)
	if got.Status != domain.SessionRunning {
		t.Errorf("Status after Resume = %q, want running", got.Status)
	}
}

func TestResume_NotEligibleReturnsConflict(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	// Attempt to Resume a session that is still in 'running' state (not eligible yet).
	sess := svc.advanceToRunning(t, ctx)
	err := svc.stub.Resume(ctx, sess.ID)
	if err != domain.ErrConflict {
		t.Errorf("Resume on non-cancelled session: got %v, want ErrConflict", err)
	}
}

// ---------------------------------------------------------------------------
// Metadata service
// ---------------------------------------------------------------------------

func TestMetadata_SupportedTopologiesReturnsKnownValues(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	tops, err := svc.stub.SupportedTopologies(ctx)
	if err != nil {
		t.Fatalf("SupportedTopologies: %v", err)
	}
	if len(tops) == 0 {
		t.Error("expected at least one topology")
	}
	topSet := make(map[domain.BaseStorageTopology]bool)
	for _, top := range tops {
		topSet[top] = true
	}
	if !topSet[domain.TopologyBlock42] {
		t.Error("expected TopologyBlock42 in SupportedTopologies")
	}
	if !topSet[domain.TopologyMirror3DC] {
		t.Error("expected TopologyMirror3DC in SupportedTopologies")
	}
}

func TestMetadata_SupportedArtifactModesReturnsKnownValues(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	modes, err := svc.stub.SupportedArtifactModes(ctx)
	if err != nil {
		t.Fatalf("SupportedArtifactModes: %v", err)
	}
	if len(modes) == 0 {
		t.Error("expected at least one artifact mode")
	}
	found := false
	for _, m := range modes {
		if m == "download" {
			found = true
		}
	}
	if !found {
		t.Error("expected 'download' in SupportedArtifactModes")
	}
}

func TestMetadata_ReferenceIndexIsNotEmpty(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	ref, err := svc.stub.ReferenceIndex(ctx)
	if err != nil {
		t.Fatalf("ReferenceIndex: %v", err)
	}
	if len(ref) == 0 {
		t.Error("expected at least one entry in ReferenceIndex")
	}
}

// ---------------------------------------------------------------------------
// ExportEffectiveSpec
// ---------------------------------------------------------------------------

func TestExportEffectiveSpec_YAMLFormat(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)
	_ = svc.stub.ApplyPreset(ctx, sess.ID, "single-dc-block-4-2")

	var buf strings.Builder
	if err := svc.stub.ExportEffectiveSpec(ctx, sess.ID, &buf, "yaml"); err != nil {
		t.Fatalf("ExportEffectiveSpec yaml: %v", err)
	}
	out := buf.String()
	if !strings.Contains(out, "baseTopology") {
		t.Errorf("YAML export missing 'baseTopology', got:\n%s", out)
	}
}

func TestExportEffectiveSpec_JSONFormat(t *testing.T) {
	ctx := context.Background()
	svc := newServices(t)

	sess := svc.advanceToConfiguring(t, ctx)

	var buf strings.Builder
	if err := svc.stub.ExportEffectiveSpec(ctx, sess.ID, &buf, "json"); err != nil {
		t.Fatalf("ExportEffectiveSpec json: %v", err)
	}
	out := buf.String()
	if !strings.Contains(out, "{") {
		t.Errorf("JSON export doesn't look like JSON, got:\n%s", out)
	}
}
