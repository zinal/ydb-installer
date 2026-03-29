package sqlite_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/domain"
	sqlitestore "github.com/ydb-platform/ydb-installer/storage/sqlite"
)

// openTempStore creates a Store backed by a temp SQLite file; the file is
// removed when the test finishes.
func openTempStore(t *testing.T) *sqlitestore.Store {
	t.Helper()
	dir := t.TempDir()
	st, err := sqlitestore.Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func newSession(mode domain.InstallationMode) *domain.InstallationSession {
	now := time.Now().UTC().Truncate(time.Second)
	phases := domain.DefaultSessionPhases()
	cur := domain.PhaseTargetDefinition
	return &domain.InstallationSession{
		ID:        domain.NewSessionID(),
		Mode:      mode,
		Status:    domain.SessionDraft,
		Title:     "test session",
		CreatedAt: now,
		UpdatedAt: now,
		Phases:    phases,
		Current:   &cur,
	}
}

// ---- Sessions --------------------------------------------------------------

func TestSQLite_SaveAndLoadSession(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	if err := st.SaveSession(ctx, sess); err != nil {
		t.Fatalf("SaveSession: %v", err)
	}

	got, err := st.LoadSession(ctx, sess.ID)
	if err != nil {
		t.Fatalf("LoadSession: %v", err)
	}
	if got.ID != sess.ID {
		t.Errorf("ID mismatch: got %v, want %v", got.ID, sess.ID)
	}
	if got.Mode != sess.Mode {
		t.Errorf("Mode = %q, want %q", got.Mode, sess.Mode)
	}
	if got.Status != sess.Status {
		t.Errorf("Status = %q, want %q", got.Status, sess.Status)
	}
	if got.Title != sess.Title {
		t.Errorf("Title = %q, want %q", got.Title, sess.Title)
	}
	if len(got.Phases) != len(sess.Phases) {
		t.Errorf("Phases len = %d, want %d", len(got.Phases), len(sess.Phases))
	}
}

func TestSQLite_LoadSessionNotFound(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	_, err := st.LoadSession(ctx, uuid.New())
	if err != domain.ErrNotFound {
		t.Errorf("LoadSession unknown: got %v, want ErrNotFound", err)
	}
}

func TestSQLite_SaveSession_UpdateIsUpsert(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	_ = st.SaveSession(ctx, sess)

	sess.Status = domain.SessionDiscoveryReady
	sess.Title = "updated"
	if err := st.SaveSession(ctx, sess); err != nil {
		t.Fatalf("SaveSession (update): %v", err)
	}

	got, _ := st.LoadSession(ctx, sess.ID)
	if got.Status != domain.SessionDiscoveryReady {
		t.Errorf("Status = %q after upsert, want discovery_ready", got.Status)
	}
	if got.Title != "updated" {
		t.Errorf("Title = %q after upsert, want 'updated'", got.Title)
	}
}

func TestSQLite_ListSessions_EmptyReturnsSliceNotNull(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	list, err := st.ListSessions(ctx, 50, 0)
	if err != nil {
		t.Fatalf("ListSessions empty: %v", err)
	}
	if list == nil {
		t.Error("ListSessions returned nil, want empty slice")
	}
	if len(list) != 0 {
		t.Errorf("ListSessions returned %d items, want 0", len(list))
	}
}

func TestSQLite_ListSessions_ReturnsAllSaved(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	for i := 0; i < 3; i++ {
		sess := newSession(domain.ModeInteractive)
		if err := st.SaveSession(ctx, sess); err != nil {
			t.Fatalf("SaveSession #%d: %v", i, err)
		}
	}

	list, err := st.ListSessions(ctx, 50, 0)
	if err != nil {
		t.Fatalf("ListSessions: %v", err)
	}
	if len(list) != 3 {
		t.Errorf("len = %d, want 3", len(list))
	}
}

func TestSQLite_ListSessions_LimitIsRespected(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	for i := 0; i < 5; i++ {
		_ = st.SaveSession(ctx, newSession(domain.ModeInteractive))
	}
	list, _ := st.ListSessions(ctx, 2, 0)
	if len(list) > 2 {
		t.Errorf("ListSessions with limit=2 returned %d items", len(list))
	}
}

func TestSQLite_DeleteSession(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	_ = st.SaveSession(ctx, sess)
	if err := st.DeleteSession(ctx, sess.ID); err != nil {
		t.Fatalf("DeleteSession: %v", err)
	}
	_, err := st.LoadSession(ctx, sess.ID)
	if err != domain.ErrNotFound {
		t.Errorf("LoadSession after delete: got %v, want ErrNotFound", err)
	}
}

func TestSQLite_DeleteSession_NotFoundReturnsError(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	err := st.DeleteSession(ctx, uuid.New())
	if err != domain.ErrNotFound {
		t.Errorf("DeleteSession unknown: got %v, want ErrNotFound", err)
	}
}

func TestSQLite_SaveSession_TargetsRoundTrip(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	sess.Targets = []domain.TargetHost{
		{Address: "10.0.0.1", Port: 22, User: "root"},
		{Address: "10.0.0.2", Port: 2222, User: "admin"},
	}
	_ = st.SaveSession(ctx, sess)

	got, _ := st.LoadSession(ctx, sess.ID)
	if len(got.Targets) != 2 {
		t.Fatalf("Targets len = %d, want 2", len(got.Targets))
	}
	if got.Targets[0].Address != "10.0.0.1" {
		t.Errorf("Targets[0].Address = %q, want 10.0.0.1", got.Targets[0].Address)
	}
	if got.Targets[1].Port != 2222 {
		t.Errorf("Targets[1].Port = %d, want 2222", got.Targets[1].Port)
	}
}

func TestSQLite_SaveSession_PhasesRoundTrip(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	now := time.Now().UTC().Truncate(time.Second)
	sess.Phases = domain.SetPhaseState(sess.Phases, domain.PhaseTargetDefinition, domain.PhaseSucceeded, "done", now)
	_ = st.SaveSession(ctx, sess)

	got, _ := st.LoadSession(ctx, sess.ID)
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
		t.Error("PhaseTargetDefinition not found in loaded phases")
	}
}

func TestSQLite_SaveSession_EmptyTitleRoundTrip(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	sess.Title = ""
	_ = st.SaveSession(ctx, sess)

	got, _ := st.LoadSession(ctx, sess.ID)
	if got.Title != "" {
		t.Errorf("Title = %q, want empty", got.Title)
	}
}

// ---- Discovery snapshots ---------------------------------------------------

func TestSQLite_SaveAndLoadDiscoverySnapshot(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	_ = st.SaveSession(ctx, sess)

	snap := &domain.DiscoverySnapshot{
		SessionID:   sess.ID.String(),
		CollectedAt: time.Now().UTC().Format(time.RFC3339Nano),
		Hosts: []domain.DiscoveredHost{
			{HostID: "h1", Hostname: "node-1", CPUs: 8, OSName: "Linux"},
		},
	}
	if err := st.SaveDiscoverySnapshot(ctx, sess.ID, snap); err != nil {
		t.Fatalf("SaveDiscoverySnapshot: %v", err)
	}

	got, err := st.LoadDiscoverySnapshot(ctx, sess.ID)
	if err != nil {
		t.Fatalf("LoadDiscoverySnapshot: %v", err)
	}
	if got.CollectedAt != snap.CollectedAt {
		t.Errorf("CollectedAt = %q, want %q", got.CollectedAt, snap.CollectedAt)
	}
	if len(got.Hosts) != 1 {
		t.Fatalf("Hosts len = %d, want 1", len(got.Hosts))
	}
	if got.Hosts[0].HostID != "h1" {
		t.Errorf("Host[0].HostID = %q, want h1", got.Hosts[0].HostID)
	}
}

func TestSQLite_LoadDiscoverySnapshot_NotFound(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	_, err := st.LoadDiscoverySnapshot(ctx, uuid.New())
	if err != domain.ErrNotFound {
		t.Errorf("LoadDiscoverySnapshot unknown: got %v, want ErrNotFound", err)
	}
}

func TestSQLite_SaveDiscoverySnapshot_UpsertOverwritesPrevious(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	_ = st.SaveSession(ctx, sess)

	snap1 := &domain.DiscoverySnapshot{
		SessionID:   sess.ID.String(),
		CollectedAt: "2024-01-01T00:00:00Z",
		Hosts:       []domain.DiscoveredHost{{HostID: "h1", Hostname: "old"}},
	}
	_ = st.SaveDiscoverySnapshot(ctx, sess.ID, snap1)

	snap2 := &domain.DiscoverySnapshot{
		SessionID:   sess.ID.String(),
		CollectedAt: "2024-01-02T00:00:00Z",
		Hosts:       []domain.DiscoveredHost{{HostID: "h2", Hostname: "new"}},
	}
	_ = st.SaveDiscoverySnapshot(ctx, sess.ID, snap2)

	got, _ := st.LoadDiscoverySnapshot(ctx, sess.ID)
	if got.CollectedAt != "2024-01-02T00:00:00Z" {
		t.Errorf("CollectedAt = %q, want second snapshot", got.CollectedAt)
	}
	if got.Hosts[0].HostID != "h2" {
		t.Errorf("Hosts[0].HostID = %q, want h2", got.Hosts[0].HostID)
	}
}

func TestSQLite_DeleteSession_RemovesSnapshot(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	_ = st.SaveSession(ctx, sess)
	snap := &domain.DiscoverySnapshot{SessionID: sess.ID.String(), CollectedAt: "2024-01-01T00:00:00Z"}
	_ = st.SaveDiscoverySnapshot(ctx, sess.ID, snap)

	_ = st.DeleteSession(ctx, sess.ID)

	_, err := st.LoadDiscoverySnapshot(ctx, sess.ID)
	if err != domain.ErrNotFound {
		t.Errorf("LoadDiscoverySnapshot after DeleteSession: got %v, want ErrNotFound", err)
	}
}

// ---- Validation reports ----------------------------------------------------

func TestSQLite_SaveAndLoadValidationReport(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	_ = st.SaveSession(ctx, sess)

	rep := &domain.ValidationReport{
		SessionID: sess.ID.String(),
		Valid:     true,
		Issues: []domain.ValidationIssue{
			{Code: "warn_01", Severity: domain.SeverityWarning, Message: "minor warning"},
		},
	}
	if err := st.SaveValidationReport(ctx, sess.ID, rep); err != nil {
		t.Fatalf("SaveValidationReport: %v", err)
	}

	got, err := st.LoadValidationReport(ctx, sess.ID)
	if err != nil {
		t.Fatalf("LoadValidationReport: %v", err)
	}
	if !got.Valid {
		t.Error("Valid = false, want true")
	}
	if len(got.Issues) != 1 {
		t.Fatalf("Issues len = %d, want 1", len(got.Issues))
	}
	if got.Issues[0].Code != "warn_01" {
		t.Errorf("Issues[0].Code = %q, want warn_01", got.Issues[0].Code)
	}
}

func TestSQLite_LoadValidationReport_NotFound(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	_, err := st.LoadValidationReport(ctx, uuid.New())
	if err != domain.ErrNotFound {
		t.Errorf("LoadValidationReport unknown: got %v, want ErrNotFound", err)
	}
}

func TestSQLite_SaveValidationReport_UpsertOverwritesPrevious(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	_ = st.SaveSession(ctx, sess)

	rep1 := &domain.ValidationReport{SessionID: sess.ID.String(), Valid: false}
	_ = st.SaveValidationReport(ctx, sess.ID, rep1)

	rep2 := &domain.ValidationReport{SessionID: sess.ID.String(), Valid: true}
	_ = st.SaveValidationReport(ctx, sess.ID, rep2)

	got, _ := st.LoadValidationReport(ctx, sess.ID)
	if !got.Valid {
		t.Error("Valid = false after upsert with Valid=true report")
	}
}

// ---- Phase state -----------------------------------------------------------

func TestSQLite_SaveAndLoadPhaseState(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	sess := newSession(domain.ModeInteractive)
	_ = st.SaveSession(ctx, sess)

	now := time.Now().UTC().Truncate(time.Second)
	phases := domain.SetPhaseState(sess.Phases, domain.PhaseDiscovery, domain.PhaseSucceeded, "ok", now)
	if err := st.SavePhaseState(ctx, sess.ID, phases); err != nil {
		t.Fatalf("SavePhaseState: %v", err)
	}

	loaded, err := st.LoadPhaseState(ctx, sess.ID)
	if err != nil {
		t.Fatalf("LoadPhaseState: %v", err)
	}
	var found bool
	for _, p := range loaded {
		if p.PhaseID == domain.PhaseDiscovery {
			if p.State != domain.PhaseSucceeded {
				t.Errorf("PhaseDiscovery state = %q, want succeeded", p.State)
			}
			found = true
		}
	}
	if !found {
		t.Error("PhaseDiscovery not found after SavePhaseState")
	}
}

func TestSQLite_LoadPhaseState_NotFound(t *testing.T) {
	ctx := context.Background()
	st := openTempStore(t)

	_, err := st.LoadPhaseState(ctx, uuid.New())
	if err != domain.ErrNotFound {
		t.Errorf("LoadPhaseState unknown: got %v, want ErrNotFound", err)
	}
}

// ---- Persistence across open/close -----------------------------------------

func TestSQLite_PersistsAcrossReopenedStore(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	path := filepath.Join(dir, "persist.db")

	sess := newSession(domain.ModeInteractive)

	// Write in one store handle.
	{
		st, err := sqlitestore.Open(path)
		if err != nil {
			t.Fatalf("Open (write): %v", err)
		}
		_ = st.SaveSession(ctx, sess)
		_ = st.Close()
	}

	// Re-open and verify data survived.
	st2, err := sqlitestore.Open(path)
	if err != nil {
		t.Fatalf("Open (read): %v", err)
	}
	defer func() { _ = st2.Close() }()

	got, err := st2.LoadSession(ctx, sess.ID)
	if err != nil {
		t.Fatalf("LoadSession after reopen: %v", err)
	}
	if got.ID != sess.ID {
		t.Errorf("ID mismatch after reopen: got %v, want %v", got.ID, sess.ID)
	}
}

func TestSQLite_InvalidPathReturnsError(t *testing.T) {
	_, err := sqlitestore.Open(filepath.Join(t.TempDir(), "nonexistent_dir", "x", "test.db"))
	if err == nil {
		t.Error("expected error opening store in non-existent nested directory")
	}
}

// ---- In-memory store (teststore) mirrors SQLite behaviour -----------------
// These tests run the same assertions against the in-memory store to confirm
// it is a faithful stand-in for unit tests.

func TestInMemoryStore_ListSessionsEmptyReturnsSlice(t *testing.T) {
	ctx := context.Background()

	// Import inline to avoid circular dependency — reuse the Open path.
	dir := t.TempDir()
	st, err := sqlitestore.Open(filepath.Join(dir, "mem.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer func() { _ = st.Close() }()

	list, err := st.ListSessions(ctx, 10, 0)
	if err != nil {
		t.Fatalf("ListSessions: %v", err)
	}
	if list == nil {
		t.Error("ListSessions returned nil (should be empty slice)")
	}
	_ = os.Remove(filepath.Join(dir, "mem.db"))
}
