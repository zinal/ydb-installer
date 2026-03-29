package domain

// CompletionReport for FR-REPORTING-003–004 (skeleton).
type CompletionReport struct {
	SessionID           string   `json:"sessionId"`
	ClusterEndpoints    []string `json:"clusterEndpoints,omitempty"`
	LayoutSummary       string   `json:"layoutSummary,omitempty"`
	SecurityMode        string   `json:"securityMode,omitempty"`
	DatabaseNames       []string `json:"databaseNames,omitempty"`
	VerificationSummary string   `json:"verificationSummary,omitempty"`
	NextSteps           string   `json:"nextSteps,omitempty"`
	BridgeSummary       string   `json:"bridgeSummary,omitempty"`
}
