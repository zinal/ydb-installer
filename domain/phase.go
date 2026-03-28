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
