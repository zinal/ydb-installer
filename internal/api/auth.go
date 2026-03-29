package api

import (
	"context"
	"net/http"
	"time"

	"github.com/ydb-platform/ydb-installer/internal/domain"
	"github.com/ydb-platform/ydb-installer/internal/security"
)

type principalContextKey struct{}

func withPrincipal(ctx context.Context, p *security.Principal) context.Context {
	return context.WithValue(ctx, principalContextKey{}, p)
}

func principalFromContext(ctx context.Context) *security.Principal {
	v := ctx.Value(principalContextKey{})
	p, _ := v.(*security.Principal)
	return p
}

func authLogin(d Deps) http.HandlerFunc {
	type loginResponse struct {
		Username string                  `json:"username"`
		Roles    []domain.Role           `json:"roles"`
		Mode     domain.InstallationMode `json:"mode"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if d.Auth == nil {
			writeAPIError(w, domain.ErrNotImplemented)
			return
		}
		role, password, err := security.ParseLoginBody(r)
		if err != nil {
			writeAPIError(w, domain.ErrValidation)
			return
		}
		p, token, err := d.Auth.Login(role, password)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     security.SessionCookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   false, // switch to true when HTTPS is enabled.
			MaxAge:   int((12 * time.Hour).Seconds()),
		})
		writeJSON(w, http.StatusOK, loginResponse{
			Username: p.Username,
			Roles:    p.Roles,
			Mode:     d.Mode,
		})
	}
}

func authLogout(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if d.Auth == nil {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if c, err := r.Cookie(security.SessionCookieName); err == nil {
			d.Auth.LogoutToken(c.Value)
		}
		http.SetCookie(w, &http.Cookie{
			Name:     security.SessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   false,
			MaxAge:   -1,
		})
		w.WriteHeader(http.StatusNoContent)
	}
}

func authMe(d Deps) http.HandlerFunc {
	type meResponse struct {
		Username string                  `json:"username"`
		Roles    []domain.Role           `json:"roles"`
		Mode     domain.InstallationMode `json:"mode"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		p := principalFromContext(r.Context())
		if p == nil {
			writeAPIError(w, domain.ErrUnauthorized)
			return
		}
		writeJSON(w, http.StatusOK, meResponse{
			Username: p.Username,
			Roles:    p.Roles,
			Mode:     d.Mode,
		})
	}
}

func requireAuth(d Deps, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if d.Auth == nil {
			writeAPIError(w, domain.ErrNotImplemented)
			return
		}
		p, err := d.Auth.AuthenticateRequest(r)
		if err != nil {
			// Keep API errors in English and avoid leaking credential details.
			writeAPIError(w, domain.ErrUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(withPrincipal(r.Context(), p)))
	})
}

func requireRole(d Deps, role domain.Role) func(http.Handler) http.Handler {
	return requireAnyRole(d, role)
}

func requireAnyRole(d Deps, roles ...domain.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p := principalFromContext(r.Context())
			if p == nil {
				writeAPIError(w, domain.ErrUnauthorized)
				return
			}
			for _, role := range roles {
				if d.Auth.HasRole(p, role) {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeAPIError(w, domain.ErrForbidden)
		})
	}
}

func requireInteractiveMode(d Deps) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if d.Mode != domain.ModeInteractive {
				writeAPIError(w, domain.ErrForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
