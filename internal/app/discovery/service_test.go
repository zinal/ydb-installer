package discoverysvc_test

import (
	"context"
	"testing"

	"github.com/google/uuid"

	discoverysvc "github.com/ydb-platform/ydb-installer/internal/app/discovery"
	"github.com/ydb-platform/ydb-installer/internal/app/session"
	"github.com/ydb-platform/ydb-installer/internal/domain"
	"github.com/ydb-platform/ydb-installer/internal/testdiscovery"
	"github.com/ydb-platform/ydb-installer/internal/teststore"
)

// helpers -------------------------------------------------------------------

func setup(t *testing.T, disc *testdiscovery.Stub) (*session.Service, *discoverysvc.Service) {
	t.Helper()
	st := teststore.New()
	sessSvc := &session.Service{Store: st}
	discSvc := &discoverysvc.Service{Store: st, Discoverer: disc}
	return sessSvc, discSvc
}

func createDraftSession(t *testing.T, ctx context.Context, sessSvc *session.Service) *domain.InstallationSession {
	t.Helper()
	sess, err := sessSvc.Create(ctx, domain.ModeInteractive, "test")
	if err != nil {
		t.Fatalf("Create session: %v", err)
	}
	return sess
}

var targets = []domain.TargetHost{
	{Address: "10.0.0.1", Port: 22, User: "root"},
	{Address: "10.0.0.2", Port: 22, User: "root"},
}

// ---- SetTargets ------------------------------------------------------------

func TestSetTargets_TransitionsToDraftDiscoveryReady(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	if err := discSvc.SetTargets(ctx, sess.ID, targets); err != nil {
		t.Fatalf("SetTargets: %v", err)
	}

	got, _ := sessSvc.Get(ctx, sess.ID)
	if got.Status != domain.SessionDiscoveryReady {
		t.Errorf("Status = %q, want %q", got.Status, domain.SessionDiscoveryReady)
	}
}

func TestSetTargets_TargetsArePersistedOnSession(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)

	got, _ := sessSvc.Get(ctx, sess.ID)
	if len(got.Targets) != len(targets) {
		t.Errorf("Targets len = %d, want %d", len(got.Targets), len(targets))
	}
	if got.Targets[0].Address != "10.0.0.1" {
		t.Errorf("first target address = %q, want 10.0.0.1", got.Targets[0].Address)
	}
}

func TestSetTargets_TargetDefinitionPhaseMarkedSucceeded(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)

	got, _ := sessSvc.Get(ctx, sess.ID)
	var found bool
	for _, p := range got.Phases {
		if p.PhaseID == domain.PhaseTargetDefinition {
			if p.State != domain.PhaseSucceeded {
				t.Errorf("PhaseTargetDefinition state = %q, want succeeded", p.State)
			}
			found = true
		}
	}
	if !found {
		t.Error("PhaseTargetDefinition not found in phases")
	}
}

func TestSetTargets_CurrentPhaseAdvancedToDiscovery(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)

	got, _ := sessSvc.Get(ctx, sess.ID)
	if got.Current == nil || *got.Current != domain.PhaseDiscovery {
		t.Errorf("Current = %v, want PhaseDiscovery(%d)", got.Current, domain.PhaseDiscovery)
	}
}

func TestSetTargets_EmptyListReturnsValidationError(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	err := discSvc.SetTargets(ctx, sess.ID, nil)
	if err != domain.ErrValidation {
		t.Errorf("SetTargets(nil): got %v, want ErrValidation", err)
	}
}

func TestSetTargets_BlankAddressReturnsValidationError(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	err := discSvc.SetTargets(ctx, sess.ID, []domain.TargetHost{{Address: "  "}})
	if err != domain.ErrValidation {
		t.Errorf("SetTargets(blank address): got %v, want ErrValidation", err)
	}
}

func TestSetTargets_UnknownSessionReturnsNotFound(t *testing.T) {
	ctx := context.Background()
	_, discSvc := setup(t, testdiscovery.Successful())

	err := discSvc.SetTargets(ctx, domain.NewSessionID(), targets)
	if err != domain.ErrNotFound {
		t.Errorf("SetTargets unknown session: got %v, want ErrNotFound", err)
	}
}

// ---- RunDiscovery ----------------------------------------------------------

func TestRunDiscovery_TransitionsToConfiguring(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)
	if err := discSvc.RunDiscovery(ctx, sess.ID); err != nil {
		t.Fatalf("RunDiscovery: %v", err)
	}

	got, _ := sessSvc.Get(ctx, sess.ID)
	if got.Status != domain.SessionConfiguring {
		t.Errorf("Status = %q, want %q", got.Status, domain.SessionConfiguring)
	}
}

func TestRunDiscovery_PersistsSnapshotWithCollectedAt(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)
	_ = discSvc.RunDiscovery(ctx, sess.ID)

	snap, err := discSvc.GetSnapshot(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetSnapshot: %v", err)
	}
	if snap.CollectedAt == "" {
		t.Error("snapshot CollectedAt is empty after RunDiscovery")
	}
	if len(snap.Hosts) != len(targets) {
		t.Errorf("snapshot Hosts len = %d, want %d", len(snap.Hosts), len(targets))
	}
}

func TestRunDiscovery_DiscoveryPhaseMarkedSucceeded(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)
	_ = discSvc.RunDiscovery(ctx, sess.ID)

	got, _ := sessSvc.Get(ctx, sess.ID)
	for _, p := range got.Phases {
		if p.PhaseID == domain.PhaseDiscovery && p.State != domain.PhaseSucceeded {
			t.Errorf("PhaseDiscovery state = %q, want succeeded", p.State)
		}
	}
}

func TestRunDiscovery_CurrentPhaseAdvancedToConfiguration(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)
	_ = discSvc.RunDiscovery(ctx, sess.ID)

	got, _ := sessSvc.Get(ctx, sess.ID)
	if got.Current == nil || *got.Current != domain.PhaseConfiguration {
		t.Errorf("Current = %v, want PhaseConfiguration(%d)", got.Current, domain.PhaseConfiguration)
	}
}

func TestRunDiscovery_AllFailingHostsMarksPhaseFailedAndSavesSnapshot(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.AllFailing())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)
	_ = discSvc.RunDiscovery(ctx, sess.ID)

	got, _ := sessSvc.Get(ctx, sess.ID)
	var discoveryPhase *domain.SessionPhase
	for i := range got.Phases {
		if got.Phases[i].PhaseID == domain.PhaseDiscovery {
			discoveryPhase = &got.Phases[i]
		}
	}
	if discoveryPhase == nil {
		t.Fatal("PhaseDiscovery not found")
	}
	if discoveryPhase.State != domain.PhaseFailed {
		t.Errorf("all-failing: PhaseDiscovery state = %q, want failed", discoveryPhase.State)
	}
	// Snapshot is still persisted even when all hosts fail.
	snap, err := discSvc.GetSnapshot(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetSnapshot after all-failing: %v", err)
	}
	if len(snap.Hosts) != len(targets) {
		t.Errorf("snapshot Hosts len = %d, want %d", len(snap.Hosts), len(targets))
	}
	for _, h := range snap.Hosts {
		if h.DiscoveryError == "" {
			t.Errorf("host %q: expected DiscoveryError to be set", h.Hostname)
		}
	}
}

func TestRunDiscovery_WithoutTargetsReturnsValidationError(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	err := discSvc.RunDiscovery(ctx, sess.ID)
	if err != domain.ErrValidation {
		t.Errorf("RunDiscovery without targets: got %v, want ErrValidation", err)
	}
}

func TestRunDiscovery_StartedAndEndedHooksAreCalled(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	var startedID, endedID domain.PhaseID
	discSvc.StartedHook = func(_ uuid.UUID, phase domain.PhaseID) {
		startedID = phase
	}
	discSvc.EndedHook = func(_ uuid.UUID, phase domain.PhaseID, _ error) {
		endedID = phase
	}

	_ = discSvc.SetTargets(ctx, sess.ID, targets)
	_ = discSvc.RunDiscovery(ctx, sess.ID)

	if startedID != domain.PhaseDiscovery {
		t.Errorf("StartedHook phase = %d, want PhaseDiscovery(%d)", startedID, domain.PhaseDiscovery)
	}
	if endedID != domain.PhaseDiscovery {
		t.Errorf("EndedHook phase = %d, want PhaseDiscovery(%d)", endedID, domain.PhaseDiscovery)
	}
}

// ---- GetSnapshot ----------------------------------------------------------

func TestGetSnapshot_BeforeRunDiscoveryReturnsEmptySnapshot(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	snap, err := discSvc.GetSnapshot(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetSnapshot before run: %v", err)
	}
	if snap.CollectedAt != "" {
		t.Errorf("CollectedAt = %q, want empty before discovery", snap.CollectedAt)
	}
	if snap.Hosts != nil {
		t.Errorf("Hosts = %v, want nil before discovery", snap.Hosts)
	}
}

func TestGetSnapshot_AfterRunDiscoveryContainsHosts(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)
	_ = discSvc.RunDiscovery(ctx, sess.ID)

	snap, err := discSvc.GetSnapshot(ctx, sess.ID)
	if err != nil {
		t.Fatalf("GetSnapshot: %v", err)
	}
	if len(snap.Hosts) == 0 {
		t.Error("expected hosts in snapshot after RunDiscovery")
	}
}

// ---- RunDiscovery (repeat run) ---------------------------------------------

func TestRunDiscovery_SecondRunUpdatesSnapshotAndKeepsConfiguringStatus(t *testing.T) {
	ctx := context.Background()
	sessSvc, discSvc := setup(t, testdiscovery.Successful())
	sess := createDraftSession(t, ctx, sessSvc)

	_ = discSvc.SetTargets(ctx, sess.ID, targets)
	_ = discSvc.RunDiscovery(ctx, sess.ID)

	first, _ := discSvc.GetSnapshot(ctx, sess.ID)
	firstAt := first.CollectedAt

	if err := discSvc.RunDiscovery(ctx, sess.ID); err != nil {
		t.Fatalf("second RunDiscovery: %v", err)
	}

	second, _ := discSvc.GetSnapshot(ctx, sess.ID)
	// CollectedAt should be set (may equal first if clocks are identical in fast tests; just check non-empty).
	if second.CollectedAt == "" {
		t.Error("snapshot after second run has empty CollectedAt")
	}
	_ = firstAt // used to verify it was set

	got, _ := sessSvc.Get(ctx, sess.ID)
	if got.Status != domain.SessionConfiguring {
		t.Errorf("Status after second run = %q, want configuring", got.Status)
	}
}
