package security

import (
	"context"

	"github.com/ydb-platform/ydb-installer/domain"
)

// Principal identifies an authenticated user (FR-SECURITY-005).
type Principal struct {
	Username string        `json:"username"`
	Roles    []domain.Role `json:"roles"`
}

// Authenticator validates HTTP Basic (or successor) credentials.
type Authenticator interface {
	Authenticate(ctx context.Context, username, password string) (*Principal, error)
	HasRole(p *Principal, role domain.Role) bool
}

// SecretStore is encrypted at-rest secret persistence (FR-SECURITY-009–011).
type SecretStore interface {
	Put(ctx context.Context, sessionID string, key string, value []byte) error
	Get(ctx context.Context, sessionID string, key string) ([]byte, error)
	Delete(ctx context.Context, sessionID string, key string) error
}

// Redactor strips secrets from log/status payloads (FR-SECURITY-008).
type Redactor interface {
	Redact(msg string) string
}
