package domain

import "time"

// PhaseID identifies an installation phase (FR-WORKFLOW-002).
type PhaseID int

const (
	PhaseTargetDefinition PhaseID = iota + 1
	PhaseDiscovery
	PhaseConfiguration
	PhasePreflightValidation
	PhaseReviewApproval
	PhaseHostPreparation
	PhaseArtifactCertificatePrep
	PhaseStorageNodeInstall
	PhaseStorageInit
	PhaseDatabaseCreation
	PhaseComputeNodeInstall
	PhasePostInstallVerification
	PhaseCompletionReporting
)

// PhaseName returns the stable API name for the phase.
func (p PhaseID) PhaseName() string {
	names := map[PhaseID]string{
		PhaseTargetDefinition:        "target_definition",
		PhaseDiscovery:               "discovery",
		PhaseConfiguration:           "configuration",
		PhasePreflightValidation:     "preflight_validation",
		PhaseReviewApproval:          "review_approval",
		PhaseHostPreparation:         "host_preparation",
		PhaseArtifactCertificatePrep: "artifact_certificate_prep",
		PhaseStorageNodeInstall:      "storage_node_install",
		PhaseStorageInit:             "storage_init",
		PhaseDatabaseCreation:        "database_creation",
		PhaseComputeNodeInstall:      "compute_node_install",
		PhasePostInstallVerification: "post_install_verification",
		PhaseCompletionReporting:     "completion_reporting",
	}
	if n, ok := names[p]; ok {
		return n
	}
	return "unknown"
}

// PhaseState is persisted per session (FR-WORKFLOW-003).
type PhaseState string

const (
	PhasePending   PhaseState = "pending"
	PhaseRunning   PhaseState = "running"
	PhaseSucceeded PhaseState = "succeeded"
	PhaseFailed    PhaseState = "failed"
	PhaseSkipped   PhaseState = "skipped"
	PhaseCancelled PhaseState = "cancelled"
)

// SessionPhase records phase result and timestamps (FR-WORKFLOW-004).
type SessionPhase struct {
	PhaseID   PhaseID    `json:"phaseId"`
	Name      string     `json:"name"`
	State     PhaseState `json:"state"`
	StartedAt *time.Time `json:"startedAt,omitempty"`
	EndedAt   *time.Time `json:"endedAt,omitempty"`
	Message   string     `json:"message,omitempty"`
}

// DefaultSessionPhases returns all workflow phases in pending state (FR-WORKFLOW-002–003).
func DefaultSessionPhases() []SessionPhase {
	order := []PhaseID{
		PhaseTargetDefinition,
		PhaseDiscovery,
		PhaseConfiguration,
		PhasePreflightValidation,
		PhaseReviewApproval,
		PhaseHostPreparation,
		PhaseArtifactCertificatePrep,
		PhaseStorageNodeInstall,
		PhaseStorageInit,
		PhaseDatabaseCreation,
		PhaseComputeNodeInstall,
		PhasePostInstallVerification,
		PhaseCompletionReporting,
	}
	out := make([]SessionPhase, len(order))
	for i, p := range order {
		out[i] = SessionPhase{
			PhaseID: p,
			Name:    p.PhaseName(),
			State:   PhasePending,
		}
	}
	return out
}

func phaseIndex(phases []SessionPhase, id PhaseID) int {
	for i := range phases {
		if phases[i].PhaseID == id {
			return i
		}
	}
	return -1
}

// SetPhaseState updates one phase's state and optional message; returns a copy.
func SetPhaseState(phases []SessionPhase, id PhaseID, state PhaseState, msg string, now time.Time) []SessionPhase {
	out := append([]SessionPhase(nil), phases...)
	idx := phaseIndex(out, id)
	if idx < 0 {
		return phases
	}
	switch state {
	case PhaseRunning:
		if out[idx].StartedAt == nil {
			t := now
			out[idx].StartedAt = &t
		}
	case PhaseSucceeded, PhaseFailed, PhaseCancelled, PhaseSkipped:
		if out[idx].StartedAt == nil {
			t := now
			out[idx].StartedAt = &t
		}
		t := now
		out[idx].EndedAt = &t
	}
	out[idx].State = state
	out[idx].Message = msg
	return out
}
