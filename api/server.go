package api

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// Server wraps the HTTP handler with optional embedded UI filesystem (FR-API-004).
type Server struct {
	Handler http.Handler
}

// NewServer returns a handler that serves API routes and, when uiFS is non-nil,
// static files from uiFS for non-API paths. Unknown GET paths fall back to index.html
// so the React SPA can handle client-side routes (browser refresh on /configuration, etc.).
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
		if strings.HasPrefix(r.URL.Path, "/api") {
			api.ServeHTTP(w, r)
			return
		}
		// Chi registers /healthz on the API router; forward so probes work when UI is embedded.
		if r.URL.Path == "/healthz" {
			api.ServeHTTP(w, r)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "Not Found", http.StatusNotFound)
			return
		}
		p := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if p == "" {
			fileServer.ServeHTTP(w, r)
			return
		}
		if _, statErr := fs.Stat(static, p); statErr != nil {
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, r2)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
