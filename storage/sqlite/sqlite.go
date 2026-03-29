package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"

	"github.com/ydb-platform/ydb-installer/domain"
	"github.com/ydb-platform/ydb-installer/storage"
)

// Store is a SQLite-backed Store (architecture §3.3).
type Store struct {
	db *sql.DB
}

var _ storage.Store = (*Store)(nil)

// Open opens (or creates) a SQLite database at path.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  targets_json TEXT,
  current_phase INTEGER,
  phases_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discovery_snapshots (
  session_id TEXT PRIMARY KEY,
  snapshot_json TEXT NOT NULL,
  collected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS validation_reports (
  session_id TEXT PRIMARY KEY,
  report_json TEXT NOT NULL
);
`)
	return err
}

func (s *Store) Open(ctx context.Context) error { return nil }

func (s *Store) Close() error {
	if s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) SaveSession(ctx context.Context, sess *domain.InstallationSession) error {
	targetsJSON, err := json.Marshal(sess.Targets)
	if err != nil {
		return err
	}
	phasesJSON, err := json.Marshal(sess.Phases)
	if err != nil {
		return err
	}
	var cur sql.NullInt64
	if sess.Current != nil {
		cur = sql.NullInt64{Int64: int64(*sess.Current), Valid: true}
	}
	_, err = s.db.ExecContext(ctx, `
INSERT INTO sessions (id, mode, status, title, created_at, updated_at, targets_json, current_phase, phases_json)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  mode = excluded.mode,
  status = excluded.status,
  title = excluded.title,
  updated_at = excluded.updated_at,
  targets_json = excluded.targets_json,
  current_phase = excluded.current_phase,
  phases_json = excluded.phases_json
`, sess.ID.String(), sess.Mode, sess.Status, nullString(sess.Title),
		sess.CreatedAt.UTC().Format(time.RFC3339Nano),
		sess.UpdatedAt.UTC().Format(time.RFC3339Nano),
		string(targetsJSON), cur, string(phasesJSON))
	return err
}

func nullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func (s *Store) LoadSession(ctx context.Context, id uuid.UUID) (*domain.InstallationSession, error) {
	row := s.db.QueryRowContext(ctx, `
SELECT mode, status, title, created_at, updated_at, targets_json, current_phase, phases_json
FROM sessions WHERE id = ?
`, id.String())
	var mode, status string
	var title sql.NullString
	var createdAt, updatedAt string
	var targetsJSON sql.NullString
	var cur sql.NullInt64
	var phasesJSON string
	if err := row.Scan(&mode, &status, &title, &createdAt, &updatedAt, &targetsJSON, &cur, &phasesJSON); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	sess := &domain.InstallationSession{
		ID:        id,
		Mode:      domain.InstallationMode(mode),
		Status:    domain.SessionStatus(status),
		CreatedAt: mustParseTime(createdAt),
		UpdatedAt: mustParseTime(updatedAt),
	}
	if title.Valid {
		sess.Title = title.String
	}
	if targetsJSON.Valid && targetsJSON.String != "" {
		_ = json.Unmarshal([]byte(targetsJSON.String), &sess.Targets)
	}
	if cur.Valid {
		p := domain.PhaseID(cur.Int64)
		sess.Current = &p
	}
	if err := json.Unmarshal([]byte(phasesJSON), &sess.Phases); err != nil {
		return nil, err
	}
	return sess, nil
}

func mustParseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		t, _ = time.Parse(time.RFC3339, s)
	}
	return t.UTC()
}

func (s *Store) ListSessions(ctx context.Context, limit, offset int) ([]domain.InstallationSession, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx, `
SELECT id, mode, status, title, created_at, updated_at, targets_json, current_phase, phases_json
FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?
`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]domain.InstallationSession, 0)
	for rows.Next() {
		var idStr, mode, status string
		var title sql.NullString
		var createdAt, updatedAt string
		var targetsJSON sql.NullString
		var cur sql.NullInt64
		var phasesJSON string
		if err := rows.Scan(&idStr, &mode, &status, &title, &createdAt, &updatedAt, &targetsJSON, &cur, &phasesJSON); err != nil {
			return nil, err
		}
		id, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}
		sess := domain.InstallationSession{
			ID:        id,
			Mode:      domain.InstallationMode(mode),
			Status:    domain.SessionStatus(status),
			CreatedAt: mustParseTime(createdAt),
			UpdatedAt: mustParseTime(updatedAt),
		}
		if title.Valid {
			sess.Title = title.String
		}
		if targetsJSON.Valid && targetsJSON.String != "" {
			_ = json.Unmarshal([]byte(targetsJSON.String), &sess.Targets)
		}
		if cur.Valid {
			p := domain.PhaseID(cur.Int64)
			sess.Current = &p
		}
		_ = json.Unmarshal([]byte(phasesJSON), &sess.Phases)
		list = append(list, sess)
	}
	return list, rows.Err()
}

func (s *Store) DeleteSession(ctx context.Context, id uuid.UUID) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `DELETE FROM discovery_snapshots WHERE session_id = ?`, id.String()); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM validation_reports WHERE session_id = ?`, id.String()); err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`, id.String())
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return tx.Commit()
}

func (s *Store) SaveDiscoverySnapshot(ctx context.Context, sessionID uuid.UUID, snap *domain.DiscoverySnapshot) error {
	b, err := json.Marshal(snap)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
INSERT INTO discovery_snapshots (session_id, snapshot_json, collected_at)
VALUES (?, ?, ?)
ON CONFLICT(session_id) DO UPDATE SET
  snapshot_json = excluded.snapshot_json,
  collected_at = excluded.collected_at
`, sessionID.String(), string(b), snap.CollectedAt)
	return err
}

func (s *Store) LoadDiscoverySnapshot(ctx context.Context, sessionID uuid.UUID) (*domain.DiscoverySnapshot, error) {
	var blob, collected string
	err := s.db.QueryRowContext(ctx,
		`SELECT snapshot_json, collected_at FROM discovery_snapshots WHERE session_id = ?`,
		sessionID.String()).Scan(&blob, &collected)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	var snap domain.DiscoverySnapshot
	if err := json.Unmarshal([]byte(blob), &snap); err != nil {
		return nil, err
	}
	return &snap, nil
}

func (s *Store) SaveValidationReport(ctx context.Context, sessionID uuid.UUID, r *domain.ValidationReport) error {
	b, err := json.Marshal(r)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
INSERT INTO validation_reports (session_id, report_json)
VALUES (?, ?)
ON CONFLICT(session_id) DO UPDATE SET report_json = excluded.report_json
`, sessionID.String(), string(b))
	return err
}

func (s *Store) LoadValidationReport(ctx context.Context, sessionID uuid.UUID) (*domain.ValidationReport, error) {
	var blob string
	err := s.db.QueryRowContext(ctx, `SELECT report_json FROM validation_reports WHERE session_id = ?`, sessionID.String()).Scan(&blob)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	var r domain.ValidationReport
	if err := json.Unmarshal([]byte(blob), &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *Store) SavePhaseState(ctx context.Context, sessionID uuid.UUID, phases []domain.SessionPhase) error {
	b, err := json.Marshal(phases)
	if err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx, `UPDATE sessions SET phases_json = ?, updated_at = ? WHERE id = ?`,
		string(b), time.Now().UTC().Format(time.RFC3339Nano), sessionID.String())
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (s *Store) LoadPhaseState(ctx context.Context, sessionID uuid.UUID) ([]domain.SessionPhase, error) {
	var phasesJSON string
	err := s.db.QueryRowContext(ctx, `SELECT phases_json FROM sessions WHERE id = ?`, sessionID.String()).Scan(&phasesJSON)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	var phases []domain.SessionPhase
	if err := json.Unmarshal([]byte(phasesJSON), &phases); err != nil {
		return nil, err
	}
	return phases, nil
}
