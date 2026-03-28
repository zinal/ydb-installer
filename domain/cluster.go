package domain

// BaseStorageTopology (§1.4, FR-LAYOUT-001).
type BaseStorageTopology string

const (
	TopologyBlock42          BaseStorageTopology = "block-4-2"
	TopologyMirror3DC        BaseStorageTopology = "mirror-3-dc"
	TopologyReducedMirror3DC BaseStorageTopology = "reduced-mirror-3-dc"
)

// ConfigGeneration (§1.4).
type ConfigGeneration string

const (
	ConfigV1 ConfigGeneration = "v1"
	ConfigV2 ConfigGeneration = "v2"
)

// NodeRole for host assignment (FR-LAYOUT-008–010).
type NodeRole string

const (
	RoleStorage        NodeRole = "storage"
	RoleCompute        NodeRole = "compute"
	RoleBroker         NodeRole = "broker"
	RoleStorageCompute NodeRole = "storage_compute"
)

// ClusterLayout holds wizard/batch configuration (§8).
type ClusterLayout struct {
	BaseTopology   BaseStorageTopology `json:"baseTopology"`
	BridgeMode     bool                `json:"bridgeMode"`
	Piles          []PileDefinition    `json:"piles,omitempty"`
	HostPlacements []HostPlacement     `json:"hostPlacements,omitempty"`
}

type PileDefinition struct {
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

type HostPlacement struct {
	HostID       string     `json:"hostId"`
	Rack         string     `json:"rack,omitempty"`
	DataCenter   string     `json:"dataCenter,omitempty"`
	Zone         string     `json:"zone,omitempty"`
	PileID       string     `json:"pileId,omitempty"`
	Roles        []NodeRole `json:"roles,omitempty"`
	ComputeCount int        `json:"computeCount,omitempty"`
}
