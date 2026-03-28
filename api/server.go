package api

import (
	"io/fs"
	"net/http"
)

// Server wraps the HTTP handler with optional embedded UI filesystem (FR-API-004).
type Server struct {
	Handler http.Handler
}

// NewServer returns a handler that serves API routes and, when uiFS is non-nil,
// static files from uiFS for non-API paths.
func NewServer(api http.Handler, uiFS fs.FS) http.Handler {
	if uiFS == nil {
		return api
	}
	static, err := fs.Sub(uiFS, "web")
	if err != nil {
		return api
	}
	fileServer := http.FileServer(http.FS(static))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(r.URL.Path) >= 4 && r.URL.Path[:4] == "/api" {
			api.ServeHTTP(w, r)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
