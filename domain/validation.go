package domain

// Severity for FR-VALIDATION-003.
type ValidationSeverity string

const (
	SeverityBlocking ValidationSeverity = "blocking"
	SeverityWarning  ValidationSeverity = "warning"
	SeverityInfo     ValidationSeverity = "info"
)

// ValidationIssue is one preflight finding (FR-VALIDATION-004).
type ValidationIssue struct {
	Code      string             `json:"code"`
	Severity  ValidationSeverity `json:"severity"`
	Message   string             `json:"message"`
	HostID    string             `json:"hostId,omitempty"`
	PhaseHint string             `json:"phaseHint,omitempty"`
}

// ValidationReport is persisted preflight output.
type ValidationReport struct {
	SessionID string            `json:"sessionId"`
	Issues    []ValidationIssue `json:"issues"`
	Valid     bool              `json:"valid"` // false if any blocking error
}
