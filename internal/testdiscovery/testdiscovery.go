// Package testdiscovery provides configurable Discoverer stubs for unit tests.
package testdiscovery

import (
	"context"

	"github.com/ydb-platform/ydb-installer/internal/discovery"
	"github.com/ydb-platform/ydb-installer/internal/domain"
)

// Stub is a Discoverer whose behaviour is controlled by test fixtures.
type Stub struct {
	// ProbeHostFn replaces ProbeHost when non-nil.
	ProbeHostFn func(ctx context.Context, target domain.TargetHost) (*domain.DiscoveredHost, error)
	// ProbeAllFn replaces ProbeAll when non-nil; takes priority over ProbeHostFn.
	ProbeAllFn func(ctx context.Context, targets []domain.TargetHost) ([]domain.DiscoveredHost, error)
}

var _ discovery.Discoverer = (*Stub)(nil)

// Successful returns a Stub that resolves every host with basic metadata and
// no error, giving tests a ready-to-use discovery result.
func Successful() *Stub {
	return &Stub{
		ProbeHostFn: func(_ context.Context, target domain.TargetHost) (*domain.DiscoveredHost, error) {
			return &domain.DiscoveredHost{
				HostID:   "host-" + target.Address,
				Hostname: target.Address,
				OSName:   "Linux",
				CPUs:     4,
				Disks: []domain.DiscoveredDisk{
					{DeviceID: "/dev/sda", SizeBytes: 100 << 30, MediaKind: "SSD"},
				},
			}, nil
		},
	}
}

// AllFailing returns a Stub where every host probe returns a discovery error
// (but not a Go error — partial failures are represented inside the host record).
func AllFailing() *Stub {
	return &Stub{
		ProbeAllFn: func(_ context.Context, targets []domain.TargetHost) ([]domain.DiscoveredHost, error) {
			hosts := make([]domain.DiscoveredHost, len(targets))
			for i, t := range targets {
				hosts[i] = domain.DiscoveredHost{
					HostID:         "host-" + t.Address,
					Hostname:       t.Address,
					DiscoveryError: "connection refused",
				}
			}
			return hosts, nil
		},
	}
}

func (s *Stub) ProbeHost(ctx context.Context, target domain.TargetHost) (*domain.DiscoveredHost, error) {
	if s.ProbeHostFn != nil {
		return s.ProbeHostFn(ctx, target)
	}
	return &domain.DiscoveredHost{HostID: "host-" + target.Address, Hostname: target.Address}, nil
}

func (s *Stub) ProbeAll(ctx context.Context, targets []domain.TargetHost) ([]domain.DiscoveredHost, error) {
	if s.ProbeAllFn != nil {
		return s.ProbeAllFn(ctx, targets)
	}
	out := make([]domain.DiscoveredHost, 0, len(targets))
	for _, t := range targets {
		h, err := s.ProbeHost(ctx, t)
		if err != nil {
			return nil, err
		}
		out = append(out, *h)
	}
	return out, nil
}
