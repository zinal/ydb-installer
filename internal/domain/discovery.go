package domain

import (
	"strconv"
	"strings"
)

// DiscoverySnapshot is immutable inventory per session (§1.4, FR-DISCOVERY-005).
type DiscoverySnapshot struct {
	SessionID   string           `json:"sessionId"`
	Hosts       []DiscoveredHost `json:"hosts"`
	CollectedAt string           `json:"collectedAt,omitempty"`
}

// DiscoveredHost aggregates FR-DISCOVERY-003 fields (subset for API shape).
type DiscoveredHost struct {
	HostID         string             `json:"hostId"`
	Hostname       string             `json:"hostname"`
	// TargetAddress is the operator-entered target from session targets (same order as discovery); FR-DISCOVERY-003 UI.
	TargetAddress  string             `json:"targetAddress,omitempty"`
	FQDN           string             `json:"fqdn,omitempty"`
	OSName         string             `json:"osName,omitempty"`
	OSVersion      string             `json:"osVersion,omitempty"`
	CPUs           int                `json:"cpus,omitempty"`
	MemoryBytes    uint64             `json:"memoryBytes,omitempty"`
	Interfaces     []NetworkInterface `json:"interfaces,omitempty"`
	Disks          []DiscoveredDisk   `json:"disks,omitempty"`
	TimeSyncHint   string             `json:"timeSyncHint,omitempty"`
	DiscoveryError string             `json:"discoveryError,omitempty"`
}

type NetworkInterface struct {
	Name  string   `json:"name"`
	Addrs []string `json:"addresses,omitempty"`
}

// DiscoveredDisk supports FR-DISCOVERY-008–010.
type DiscoveredDisk struct {
	DeviceID     string `json:"deviceId"`
	SizeBytes    uint64 `json:"sizeBytes,omitempty"`
	MediaKind    string `json:"mediaKind,omitempty"` // HDD, SSD, NVMe
	SystemDisk   bool   `json:"systemDisk,omitempty"`
	Mounted      bool   `json:"mounted,omitempty"`
	Empty        bool   `json:"empty,omitempty"`
	HasYDBLabels bool   `json:"hasYdbLabels,omitempty"`
	Detail       string `json:"detail,omitempty"`
}

// TargetHost defines SSH targets before discovery (FR-DISCOVERY-001).
type TargetHost struct {
	Address     string `json:"address"`
	Port        int    `json:"port,omitempty"`
	User        string `json:"user,omitempty"`
	// SSHPassword is optional password auth (FR-DISCOVERY-002A). Omitted from JSON API responses (FR-SECURITY-008).
	SSHPassword *string `json:"sshPassword,omitempty"`
	BastionHost string  `json:"bastionHost,omitempty"`
	BastionUser string  `json:"bastionUser,omitempty"`
	HostID      string  `json:"hostId,omitempty"`
}

// NormalizeSSHPort returns a positive TCP port, defaulting to 22.
func NormalizeSSHPort(port int) int {
	if port <= 0 {
		return 22
	}
	return port
}

// MergeTargetHosts overlays incoming onto prev. When SSHPassword is omitted (nil), the previous row's password is kept if the host key (address + port) matches. A non-nil password (including empty after trim) replaces or clears the stored value.
func MergeTargetHosts(prev, incoming []TargetHost) []TargetHost {
	out := make([]TargetHost, len(incoming))
	for i := range incoming {
		t := incoming[i]
		if t.SSHPassword != nil {
			p := strings.TrimSpace(*t.SSHPassword)
			if p == "" {
				t.SSHPassword = nil
			} else {
				t.SSHPassword = &p
			}
		} else if i < len(prev) && targetHostMergeKey(prev[i]) == targetHostMergeKey(t) {
			t.SSHPassword = prev[i].SSHPassword
		}
		out[i] = t
	}
	return out
}

func targetHostMergeKey(t TargetHost) string {
	return strings.TrimSpace(strings.ToLower(t.Address)) + "\x00" + strconv.Itoa(NormalizeSSHPort(t.Port))
}
