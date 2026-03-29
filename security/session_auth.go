package security

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/ydb-platform/ydb-installer/domain"
)

const (
	// SessionCookieName stores authenticated UI/API session identity.
	SessionCookieName = "ydb_installer_session"
)

type authCredential struct {
	username string
	password string
	role     domain.Role
}

type sessionEntry struct {
	principal Principal
	expiresAt time.Time
}

// AuthConfig defines startup auth credentials and runtime mode.
type AuthConfig struct {
	Mode domain.InstallationMode

	OperatorPassword string
	ObserverPassword string
}

// SessionAuth provides startup-credential auth and cookie-backed sessions.
type SessionAuth struct {
	mode  domain.InstallationMode
	ttl   time.Duration
	creds map[domain.Role]authCredential

	mu       sync.RWMutex
	sessions map[string]sessionEntry
}

func NewSessionAuth(cfg AuthConfig) *SessionAuth {
	mode := cfg.Mode
	if mode != domain.ModeBatch {
		mode = domain.ModeInteractive
	}
	return &SessionAuth{
		mode: mode,
		ttl:  12 * time.Hour,
		creds: map[domain.Role]authCredential{
			domain.RoleOperator: {
				username: "operator",
				password: cfg.OperatorPassword,
				role:     domain.RoleOperator,
			},
			domain.RoleObserver: {
				username: "observer",
				password: cfg.ObserverPassword,
				role:     domain.RoleObserver,
			},
		},
		sessions: make(map[string]sessionEntry),
	}
}

func (a *SessionAuth) Mode() domain.InstallationMode {
	return a.mode
}

func (a *SessionAuth) HasRole(p *Principal, role domain.Role) bool {
	if p == nil {
		return false
	}
	for _, r := range p.Roles {
		if r == role {
			return true
		}
	}
	return false
}

func (a *SessionAuth) Login(role domain.Role, password string) (*Principal, string, error) {
	cred, ok := a.creds[role]
	if !ok || cred.password == "" || subtleConstantTimeEqual(cred.password, password) == false {
		return nil, "", domain.ErrUnauthorized
	}
	p := &Principal{
		Username: cred.username,
		Roles:    []domain.Role{cred.role},
	}
	token, err := randomToken(32)
	if err != nil {
		return nil, "", err
	}
	a.mu.Lock()
	a.sessions[token] = sessionEntry{
		principal: *p,
		expiresAt: time.Now().UTC().Add(a.ttl),
	}
	a.mu.Unlock()
	return p, token, nil
}

func (a *SessionAuth) LogoutToken(token string) {
	if strings.TrimSpace(token) == "" {
		return
	}
	a.mu.Lock()
	delete(a.sessions, token)
	a.mu.Unlock()
}

func (a *SessionAuth) AuthenticateRequest(r *http.Request) (*Principal, error) {
	if c, err := r.Cookie(SessionCookieName); err == nil {
		if p := a.principalFromToken(c.Value); p != nil {
			return p, nil
		}
	}
	user, pass, ok := r.BasicAuth()
	if !ok {
		return nil, domain.ErrUnauthorized
	}
	p := a.verifyBasic(user, pass)
	if p == nil {
		return nil, domain.ErrUnauthorized
	}
	return p, nil
}

func (a *SessionAuth) principalFromToken(token string) *Principal {
	a.mu.RLock()
	e, ok := a.sessions[token]
	a.mu.RUnlock()
	if !ok {
		return nil
	}
	if time.Now().UTC().After(e.expiresAt) {
		a.mu.Lock()
		delete(a.sessions, token)
		a.mu.Unlock()
		return nil
	}
	p := e.principal
	return &p
}

func (a *SessionAuth) verifyBasic(username, password string) *Principal {
	for _, c := range a.creds {
		if c.password == "" {
			continue
		}
		if subtleConstantTimeEqual(c.username, username) && subtleConstantTimeEqual(c.password, password) {
			return &Principal{
				Username: c.username,
				Roles:    []domain.Role{c.role},
			}
		}
	}
	return nil
}

func subtleConstantTimeEqual(a, b string) bool {
	ab := []byte(a)
	bb := []byte(b)
	if len(ab) != len(bb) {
		return false
	}
	var v byte
	for i := range ab {
		v |= ab[i] ^ bb[i]
	}
	return v == 0
}

func randomToken(n int) (string, error) {
	if n <= 0 {
		return "", errors.New("invalid token size")
	}
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// ParseLoginBody decodes login payload.
func ParseLoginBody(r *http.Request) (domain.Role, string, error) {
	type body struct {
		Role     domain.Role `json:"role"`
		Password string      `json:"password"`
	}
	var b body
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		return "", "", err
	}
	return b.Role, b.Password, nil
}
