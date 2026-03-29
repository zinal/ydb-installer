package session_test

import (
	"context"
	"testing"

	"github.com/ydb-platform/ydb-installer/app"
	"github.com/ydb-platform/ydb-installer/app/session"
	"github.com/ydb-platform/ydb-installer/domain"
	"github.com/ydb-platform/ydb-installer/internal/teststore"
)

func newService(t *testing.T) *session.Service {
	t.Helper()
	return &session.Service{Store: teststore.New()}
}

// ---- Create ----------------------------------------------------------------

func TestCreate_ReturnsSessionWithExpectedFields(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	sess, err := svc.Create(ctx, domain.ModeInteractive, "test session")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if sess.ID.String() == "" {
		t.Error("expected non-empty ID")
	}
	if sess.Mode != domain.ModeInteractive {
		t.Errorf("Mode = %q, want %q", sess.Mode, domain.ModeInteractive)
	}
	if sess.Status != domain.SessionDraft {
		t.Errorf("Status = %q, want %q", sess.Status, domain.SessionDraft)
	}
	if sess.Title != "test session" {
		t.Errorf("Title = %q, want %q", sess.Title, "test session")
	}
	if len(sess.Phases) == 0 {
		t.Error("expected default phases to be populated")
	}
	if sess.Current == nil {
		t.Error("expected Current to be set after Create")
	}
}

func TestCreate_PhasesAllPendingExceptFirst(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	sess, err := svc.Create(ctx, domain.ModeInteractive, "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	for _, p := range sess.Phases {
		if p.State != domain.PhasePending {
			t.Errorf("phase %d (%s) state = %q, want %q", p.PhaseID, p.Name, p.State, domain.PhasePending)
		}
	}
}

func TestCreate_BatchMode(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	sess, err := svc.Create(ctx, domain.ModeBatch, "batch")
	if err != nil {
		t.Fatalf("Create batch: %v", err)
	}
	if sess.Mode != domain.ModeBatch {
		t.Errorf("Mode = %q, want batch", sess.Mode)
	}
}

// ---- Get -------------------------------------------------------------------

func TestGet_ReturnsCreatedSession(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	created, _ := svc.Create(ctx, domain.ModeInteractive, "")
	got, err := svc.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID mismatch: got %v, want %v", got.ID, created.ID)
	}
}

func TestGet_NotFoundReturnsError(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	_, err := svc.Get(ctx, domain.NewSessionID())
	if err != domain.ErrNotFound {
		t.Errorf("Get unknown: got %v, want ErrNotFound", err)
	}
}

// ---- List ------------------------------------------------------------------

func TestList_EmptyStoreReturnsEmptySlice(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	list, err := svc.List(ctx, 50, 0)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if list == nil {
		t.Error("List returned nil, want empty slice")
	}
	if len(list) != 0 {
		t.Errorf("List returned %d items, want 0", len(list))
	}
}

func TestList_ReturnsAllCreatedSessions(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	for i := 0; i < 3; i++ {
		if _, err := svc.Create(ctx, domain.ModeInteractive, ""); err != nil {
			t.Fatalf("Create #%d: %v", i, err)
		}
	}

	list, err := svc.List(ctx, 50, 0)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 3 {
		t.Errorf("List returned %d items, want 3", len(list))
	}
}

func TestList_LimitIsRespected(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	for i := 0; i < 5; i++ {
		if _, err := svc.Create(ctx, domain.ModeInteractive, ""); err != nil {
			t.Fatalf("Create: %v", err)
		}
	}

	list, err := svc.List(ctx, 2, 0)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) > 2 {
		t.Errorf("List returned %d items with limit=2", len(list))
	}
}

// ---- Delete ----------------------------------------------------------------

func TestDelete_RemovesSession(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	sess, _ := svc.Create(ctx, domain.ModeInteractive, "")
	if err := svc.Delete(ctx, sess.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	_, err := svc.Get(ctx, sess.ID)
	if err != domain.ErrNotFound {
		t.Errorf("Get after Delete: got %v, want ErrNotFound", err)
	}
}

func TestDelete_UnknownIDReturnsNotFound(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	err := svc.Delete(ctx, domain.NewSessionID())
	if err != domain.ErrNotFound {
		t.Errorf("Delete unknown: got %v, want ErrNotFound", err)
	}
}

// ---- UpdateDraft -----------------------------------------------------------

func TestUpdateDraft_TitleIsUpdated(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	sess, _ := svc.Create(ctx, domain.ModeInteractive, "old title")
	newTitle := "new title"
	if err := svc.UpdateDraft(ctx, sess.ID, app.SessionDraftPatch{Title: &newTitle}); err != nil {
		t.Fatalf("UpdateDraft: %v", err)
	}
	got, _ := svc.Get(ctx, sess.ID)
	if got.Title != newTitle {
		t.Errorf("Title = %q, want %q", got.Title, newTitle)
	}
}

func TestUpdateDraft_NilTitlePatchLeavesTitle(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	sess, _ := svc.Create(ctx, domain.ModeInteractive, "keep me")
	if err := svc.UpdateDraft(ctx, sess.ID, app.SessionDraftPatch{}); err != nil {
		t.Fatalf("UpdateDraft: %v", err)
	}
	got, _ := svc.Get(ctx, sess.ID)
	if got.Title != "keep me" {
		t.Errorf("Title = %q, want %q", got.Title, "keep me")
	}
}

func TestUpdateDraft_UpdatedAtAdvances(t *testing.T) {
	ctx := context.Background()
	svc := newService(t)

	sess, _ := svc.Create(ctx, domain.ModeInteractive, "")
	before := sess.UpdatedAt
	newTitle := "x"
	_ = svc.UpdateDraft(ctx, sess.ID, app.SessionDraftPatch{Title: &newTitle})
	got, _ := svc.Get(ctx, sess.ID)
	if !got.UpdatedAt.After(before) {
		t.Error("UpdatedAt did not advance after UpdateDraft")
	}
}
