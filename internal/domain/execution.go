package domain

import "time"

// TaskStatus for persisted workflow tasks.
type TaskStatus string

const (
	TaskPending   TaskStatus = "pending"
	TaskRunning   TaskStatus = "running"
	TaskSucceeded TaskStatus = "succeeded"
	TaskFailed    TaskStatus = "failed"
	TaskCancelled TaskStatus = "cancelled"
)

// ExecutionTask is a unit of work within a phase (architecture §3.6).
type ExecutionTask struct {
	ID        string     `json:"id"`
	PhaseID   PhaseID    `json:"phaseId"`
	Name      string     `json:"name"`
	Status    TaskStatus `json:"status"`
	HostID    string     `json:"hostId,omitempty"`
	PileID    string     `json:"pileId,omitempty"`
	StartedAt *time.Time `json:"startedAt,omitempty"`
	EndedAt   *time.Time `json:"endedAt,omitempty"`
	Error     string     `json:"error,omitempty"`
}

// ProgressSnapshot for FR-MONITORING-002 (API shape).
type ProgressSnapshot struct {
	SessionID      string          `json:"sessionId"`
	CurrentPhase   PhaseID         `json:"currentPhaseId"`
	CurrentTask    string          `json:"currentTask,omitempty"`
	Tasks          []ExecutionTask `json:"tasks,omitempty"`
	ElapsedSeconds int64           `json:"elapsedSeconds,omitempty"`
	RecentLogLines []string        `json:"recentLogLines,omitempty"`
	OverallPercent int             `json:"overallPercent,omitempty"`
}
