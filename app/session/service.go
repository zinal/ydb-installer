package session

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/app"
	"github.com/ydb-platform/ydb-installer/domain"
	"github.com/ydb-platform/ydb-installer/storage"
)

// Service implements app.SessionService using a Store.
type Service struct {
	Store storage.Store
}

func (s *Service) Create(ctx context.Context, mode domain.InstallationMode, title string) (*domain.InstallationSession, error) {
	now := time.Now().UTC()
	phases := domain.DefaultSessionPhases()
	cur := domain.PhaseTargetDefinition
	sess := &domain.InstallationSession{
		ID:        domain.NewSessionID(),
		Mode:      mode,
		Status:    domain.SessionDraft,
		Title:     title,
		CreatedAt: now,
		UpdatedAt: now,
		Phases:    phases,
		Current:   &cur,
	}
	if err := s.Store.SaveSession(ctx, sess); err != nil {
		return nil, err
	}
	return sess, nil
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (*domain.InstallationSession, error) {
	return s.Store.LoadSession(ctx, id)
}

func (s *Service) List(ctx context.Context, limit, offset int) ([]domain.InstallationSession, error) {
	return s.Store.ListSessions(ctx, limit, offset)
}

func (s *Service) UpdateDraft(ctx context.Context, id uuid.UUID, patch app.SessionDraftPatch) error {
	sess, err := s.Store.LoadSession(ctx, id)
	if err != nil {
		return err
	}
	if patch.Title != nil {
		sess.Title = *patch.Title
	}
	sess.UpdatedAt = time.Now().UTC()
	return s.Store.SaveSession(ctx, sess)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	return s.Store.DeleteSession(ctx, id)
}
