package domain

import (
	"time"

	"github.com/google/uuid"
)

// InstallationMode (§1.4).
type InstallationMode string

const (
	ModeInteractive InstallationMode = "interactive"
	ModeBatch       InstallationMode = "batch"
)

// SessionStatus is the high-level persisted workflow state.
type SessionStatus string

const (
	SessionDraft            SessionStatus = "draft"
	SessionDiscoveryReady   SessionStatus = "discovery_ready"
	SessionConfiguring      SessionStatus = "configuring"
	SessionValidating       SessionStatus = "validating"
	SessionAwaitingApproval SessionStatus = "awaiting_approval"
	SessionRunning          SessionStatus = "running"
	SessionCancelRequested  SessionStatus = "cancel_requested"
	SessionCompleted        SessionStatus = "completed"
	SessionFailed           SessionStatus = "failed"
	SessionCancelled        SessionStatus = "cancelled"
)

// Role matches §3.1 (FR-ACCESS-001).
type Role string

const (
	RoleOperator Role = "operator"
	RoleObserver Role = "observer"
)

// InstallationSession is one persisted workflow instance (§1.4).
type InstallationSession struct {
	ID        uuid.UUID        `json:"id"`
	Mode      InstallationMode `json:"mode"`
	Status    SessionStatus    `json:"status"`
	Title     string           `json:"title,omitempty"`
	CreatedAt time.Time        `json:"createdAt"`
	UpdatedAt time.Time        `json:"updatedAt"`
	Phases    []SessionPhase   `json:"phases,omitempty"`
	Current   *PhaseID         `json:"currentPhaseId,omitempty"`
	// Targets are SSH endpoints for phase 1 (target definition); persisted for autosave (FR-INTERACTIVE-004).
	Targets []TargetHost `json:"targets,omitempty"`
}

// NewSessionID generates a new session identifier.
func NewSessionID() uuid.UUID {
	return uuid.New()
}
