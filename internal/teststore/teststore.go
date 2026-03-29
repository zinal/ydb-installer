// Package teststore provides an in-memory storage.Store implementation for use
// in unit and integration tests.  It is intentionally simple: no concurrency
// beyond a single mutex, no persistence across process restarts.
package teststore

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/internal/domain"
	"github.com/ydb-platform/ydb-installer/internal/storage"
)

// Store is a thread-safe in-memory implementation of storage.Store.
type Store struct {
	mu          sync.RWMutex
	sessions    map[uuid.UUID]*domain.InstallationSession
	snapshots   map[uuid.UUID]*domain.DiscoverySnapshot
	validations map[uuid.UUID]*domain.ValidationReport
}

var _ storage.Store = (*Store)(nil)

// New returns a ready-to-use empty Store.
func New() *Store {
	return &Store{
		sessions:    make(map[uuid.UUID]*domain.InstallationSession),
		snapshots:   make(map[uuid.UUID]*domain.DiscoverySnapshot),
		validations: make(map[uuid.UUID]*domain.ValidationReport),
	}
}

func (s *Store) Open(_ context.Context) error { return nil }
func (s *Store) Close() error                 { return nil }

func (s *Store) SaveSession(_ context.Context, sess *domain.InstallationSession) error {
	cp := *sess
	s.mu.Lock()
	s.sessions[sess.ID] = &cp
	s.mu.Unlock()
	return nil
}

func (s *Store) LoadSession(_ context.Context, id uuid.UUID) (*domain.InstallationSession, error) {
	s.mu.RLock()
	v, ok := s.sessions[id]
	s.mu.RUnlock()
	if !ok {
		return nil, domain.ErrNotFound
	}
	cp := *v
	return &cp, nil
}

func (s *Store) ListSessions(_ context.Context, limit, offset int) ([]domain.InstallationSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]domain.InstallationSession, 0, len(s.sessions))
	for _, v := range s.sessions {
		out = append(out, *v)
	}
	if offset >= len(out) {
		return []domain.InstallationSession{}, nil
	}
	out = out[offset:]
	if limit > 0 && limit < len(out) {
		out = out[:limit]
	}
	return out, nil
}

func (s *Store) DeleteSession(_ context.Context, id uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.sessions[id]; !ok {
		return domain.ErrNotFound
	}
	delete(s.sessions, id)
	delete(s.snapshots, id)
	delete(s.validations, id)
	return nil
}

func (s *Store) SaveDiscoverySnapshot(_ context.Context, sessionID uuid.UUID, snap *domain.DiscoverySnapshot) error {
	cp := *snap
	s.mu.Lock()
	s.snapshots[sessionID] = &cp
	s.mu.Unlock()
	return nil
}

func (s *Store) LoadDiscoverySnapshot(_ context.Context, sessionID uuid.UUID) (*domain.DiscoverySnapshot, error) {
	s.mu.RLock()
	v, ok := s.snapshots[sessionID]
	s.mu.RUnlock()
	if !ok {
		return nil, domain.ErrNotFound
	}
	cp := *v
	return &cp, nil
}

func (s *Store) SaveValidationReport(_ context.Context, sessionID uuid.UUID, r *domain.ValidationReport) error {
	cp := *r
	s.mu.Lock()
	s.validations[sessionID] = &cp
	s.mu.Unlock()
	return nil
}

func (s *Store) LoadValidationReport(_ context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error) {
	s.mu.RLock()
	v, ok := s.validations[sessionID]
	s.mu.RUnlock()
	if !ok {
		return nil, domain.ErrNotFound
	}
	cp := *v
	return &cp, nil
}

func (s *Store) SavePhaseState(_ context.Context, sessionID uuid.UUID, phases []domain.SessionPhase) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[sessionID]
	if !ok {
		return domain.ErrNotFound
	}
	cp := make([]domain.SessionPhase, len(phases))
	copy(cp, phases)
	sess.Phases = cp
	return nil
}

func (s *Store) LoadPhaseState(_ context.Context, sessionID uuid.UUID) ([]domain.SessionPhase, error) {
	s.mu.RLock()
	v, ok := s.sessions[sessionID]
	s.mu.RUnlock()
	if !ok {
		return nil, domain.ErrNotFound
	}
	cp := make([]domain.SessionPhase, len(v.Phases))
	copy(cp, v.Phases)
	return cp, nil
}
