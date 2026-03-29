package discoverysvc

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	discinv "github.com/ydb-platform/ydb-installer/internal/discovery"
	"github.com/ydb-platform/ydb-installer/internal/domain"
	"github.com/ydb-platform/ydb-installer/internal/storage"
)

// Service implements app.DiscoveryService (§5, FR-DISCOVERY-001–007).
type Service struct {
	Store       storage.Store
	Discoverer  discinv.Discoverer
	StartedHook func(sessionID uuid.UUID, phase domain.PhaseID)
	EndedHook   func(sessionID uuid.UUID, phase domain.PhaseID, err error)
}

func (s *Service) SetTargets(ctx context.Context, sessionID uuid.UUID, targets []domain.TargetHost) error {
	if len(targets) == 0 {
		return domain.ErrValidation
	}
	for _, t := range targets {
		if strings.TrimSpace(t.Address) == "" {
			return domain.ErrValidation
		}
	}
	sess, err := s.Store.LoadSession(ctx, sessionID)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	phases := domain.SetPhaseState(sess.Phases, domain.PhaseTargetDefinition, domain.PhaseSucceeded, "", now)
	cur := domain.PhaseDiscovery
	sess.Targets = targets
	sess.Phases = phases
	sess.Current = &cur
	sess.Status = domain.SessionDiscoveryReady
	sess.UpdatedAt = now
	return s.Store.SaveSession(ctx, sess)
}

func (s *Service) RunDiscovery(ctx context.Context, sessionID uuid.UUID) error {
	return s.runDiscovery(ctx, sessionID)
}

func (s *Service) RefreshDiscovery(ctx context.Context, sessionID uuid.UUID) error {
	return s.runDiscovery(ctx, sessionID)
}

func (s *Service) runDiscovery(ctx context.Context, sessionID uuid.UUID) error {
	sess, err := s.Store.LoadSession(ctx, sessionID)
	if err != nil {
		return err
	}
	if len(sess.Targets) == 0 {
		return domain.ErrValidation
	}
	now := time.Now().UTC()
	phases := domain.SetPhaseState(sess.Phases, domain.PhaseDiscovery, domain.PhaseRunning, "", now)
	sess.Phases = phases
	sess.UpdatedAt = now
	if err := s.Store.SaveSession(ctx, sess); err != nil {
		return err
	}
	if s.StartedHook != nil {
		s.StartedHook(sessionID, domain.PhaseDiscovery)
	}

	disc := s.Discoverer
	if disc == nil {
		disc = discinv.SSHDiscoverer{}
	}
	hosts, _ := disc.ProbeAll(ctx, sess.Targets)

	collectedAt := time.Now().UTC().Format(time.RFC3339Nano)
	snap := &domain.DiscoverySnapshot{
		SessionID:   sessionID.String(),
		Hosts:       hosts,
		CollectedAt: collectedAt,
	}
	if err := s.Store.SaveDiscoverySnapshot(ctx, sessionID, snap); err != nil {
		s.failDiscovery(ctx, sessionID, now, err)
		if s.EndedHook != nil {
			s.EndedHook(sessionID, domain.PhaseDiscovery, err)
		}
		return err
	}

	sess, err = s.Store.LoadSession(ctx, sessionID)
	if err != nil {
		return err
	}
	now = time.Now().UTC()
	msg := ""
	state := domain.PhaseSucceeded
	// Partial host failures still complete the discovery phase (FR-DISCOVERY-004).
	allFailed := len(hosts) > 0
	for _, h := range hosts {
		if h.DiscoveryError == "" {
			allFailed = false
			break
		}
	}
	if allFailed {
		state = domain.PhaseFailed
		msg = "discovery failed for all targets"
	}
	phases = domain.SetPhaseState(sess.Phases, domain.PhaseDiscovery, state, msg, now)
	sess.Phases = phases
	next := domain.PhaseConfiguration
	sess.Current = &next
	sess.Status = domain.SessionConfiguring
	sess.UpdatedAt = now
	if err := s.Store.SaveSession(ctx, sess); err != nil {
		if s.EndedHook != nil {
			s.EndedHook(sessionID, domain.PhaseDiscovery, err)
		}
		return err
	}
	if s.EndedHook != nil {
		s.EndedHook(sessionID, domain.PhaseDiscovery, nil)
	}
	return nil
}

func (s *Service) failDiscovery(ctx context.Context, sessionID uuid.UUID, t time.Time, cause error) {
	sess, err := s.Store.LoadSession(ctx, sessionID)
	if err != nil {
		return
	}
	msg := "discovery failed"
	if cause != nil {
		msg = cause.Error()
	}
	phases := domain.SetPhaseState(sess.Phases, domain.PhaseDiscovery, domain.PhaseFailed, msg, t)
	sess.Phases = phases
	sess.UpdatedAt = time.Now().UTC()
	_ = s.Store.SaveSession(ctx, sess)
}

func (s *Service) GetSnapshot(ctx context.Context, sessionID uuid.UUID) (*domain.DiscoverySnapshot, error) {
	snap, err := s.Store.LoadDiscoverySnapshot(ctx, sessionID)
	if err != nil {
		if err == domain.ErrNotFound {
			return &domain.DiscoverySnapshot{
				SessionID: sessionID.String(),
				Hosts:     nil,
			}, nil
		}
		return nil, err
	}
	return snap, nil
}
