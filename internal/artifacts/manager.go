package artifacts

import (
	"context"
	"io"

	"github.com/google/uuid"
)

// SourceMode for FR-ARTIFACT-001.
type SourceMode string

const (
	ModeWebDownload   SourceMode = "web_download"
	ModeLocalArchive  SourceMode = "local_archive"
	ModeLocalBinaries SourceMode = "local_binaries"
)

// Manager handles local artifact intake and verification (architecture §3.7 adjunct).
type Manager interface {
	ValidateSource(ctx context.Context, sessionID uuid.UUID, mode SourceMode, paths []string) error
	StageArchive(ctx context.Context, sessionID uuid.UUID, r io.Reader, filename string) error
	ResolvePaths(ctx context.Context, sessionID uuid.UUID) ([]string, error)
}
