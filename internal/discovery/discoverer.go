package discovery

import (
	"context"

	"github.com/ydb-platform/ydb-installer/internal/domain"
)

// Discoverer performs SSH-based inventory (architecture §3.5).
type Discoverer interface {
	ProbeHost(ctx context.Context, target domain.TargetHost) (*domain.DiscoveredHost, error)
	ProbeAll(ctx context.Context, targets []domain.TargetHost) ([]domain.DiscoveredHost, error)
}
