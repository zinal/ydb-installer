package domain

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
	FQDN           string             `json:"fqdn,omitempty"`
	OSName         string             `json:"osName,omitempty"`
	OSVersion      string             `json:"osVersion,omitempty"`
	CPUs           int                `json:"cpus,omitempty"`
	MemoryBytes    uint64             `json:"memoryBytes,omitempty"`
	Interfaces     []NetworkInterface `json:"interfaces,omitempty"`
	Disks          []DiscoveredDisk   `json:"disks,omitempty"`
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
	BastionHost string `json:"bastionHost,omitempty"`
	BastionUser string `json:"bastionUser,omitempty"`
	HostID      string `json:"hostId,omitempty"`
}
