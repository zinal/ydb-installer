package api

import "github.com/ydb-platform/ydb-installer/internal/domain"

// redactSessionForAPI returns a copy safe to serialize: SSH passwords are never exposed (FR-SECURITY-008).
func redactSessionForAPI(s *domain.InstallationSession) *domain.InstallationSession {
	if s == nil {
		return nil
	}
	out := *s
	if len(out.Targets) > 0 {
		out.Targets = make([]domain.TargetHost, len(s.Targets))
		for i := range s.Targets {
			t := s.Targets[i]
			t.SSHPassword = nil
			out.Targets[i] = t
		}
	}
	return &out
}

func redactSessionsForAPI(list []domain.InstallationSession) []domain.InstallationSession {
	if len(list) == 0 {
		return list
	}
	out := make([]domain.InstallationSession, len(list))
	for i := range list {
		rs := redactSessionForAPI(&list[i])
		out[i] = *rs
	}
	return out
}
