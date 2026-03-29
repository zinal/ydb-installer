package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/ydb-platform/ydb-installer/internal/domain"
)

// NewRouter mounts REST routes (see openapi/openapi.yaml).
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/login", authLogin(d))
		r.Post("/logout", authLogout(d))
		r.With(func(next http.Handler) http.Handler { return requireAuth(d, next) }).Get("/me", authMe(d))
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler { return requireAuth(d, next) })
		r.Get("/metadata/topologies", getTopologies(d))
		r.Get("/metadata/artifact-modes", getArtifactModes(d))
		r.Get("/metadata/reference", getReference(d))
		r.Get("/metadata/runtime", getRuntime(d))

		r.Route("/sessions", func(r chi.Router) {
			r.Get("/", listSessions(d))
			r.With(requireAnyRole(d, domain.RoleOperator, domain.RoleObserver)).Post("/", createSession(d))
			r.Route("/{sessionID}", func(r chi.Router) {
				r.Get("/", getSession(d))
				r.With(requireRole(d, domain.RoleOperator), requireInteractiveMode(d)).Patch("/", patchSession(d))
				r.With(requireRole(d, domain.RoleOperator), requireInteractiveMode(d)).Delete("/", deleteSession(d))

				r.With(requireRole(d, domain.RoleOperator), requireInteractiveMode(d)).Post("/targets", setTargets(d))
				r.With(requireRole(d, domain.RoleOperator), requireInteractiveMode(d)).Post("/discovery/run", runDiscovery(d))
				r.Get("/discovery", getDiscovery(d))
				r.With(requireRole(d, domain.RoleOperator), requireInteractiveMode(d)).Post("/discovery/refresh", refreshDiscovery(d))

				r.Get("/configuration", getConfiguration(d))
				r.With(requireRole(d, domain.RoleOperator), requireInteractiveMode(d)).Put("/configuration", putConfiguration(d))
				r.With(requireRole(d, domain.RoleOperator), requireInteractiveMode(d)).Post("/configuration/import/yaml", importYAML(d))
				r.With(requireRole(d, domain.RoleOperator), requireInteractiveMode(d)).Post("/configuration/import/json", importJSON(d))
				r.Get("/configuration/export/yaml", exportYAML(d))
				r.Get("/presets", listPresets(d))
				r.With(requireRole(d, domain.RoleOperator), requireInteractiveMode(d)).Post("/presets/{presetID}/apply", applyPreset(d))

				r.With(requireRole(d, domain.RoleOperator)).Post("/validation/run", runValidation(d))
				r.Get("/validation", getValidation(d))

				r.With(requireRole(d, domain.RoleOperator)).Post("/execution/approve", approveExecution(d))
				r.With(requireRole(d, domain.RoleOperator)).Post("/execution/start", startExecution(d))
				r.With(requireRole(d, domain.RoleOperator)).Post("/execution/cancel", cancelExecution(d))
				r.With(requireRole(d, domain.RoleOperator)).Post("/execution/resume", resumeExecution(d))
				r.Get("/execution/progress", getProgress(d))

				r.Get("/report/completion", getCompletionReport(d))
				r.Get("/report/export", exportSpec(d))
				r.Get("/logs", getLogs(d))
			})
		})
	})

	return r
}
