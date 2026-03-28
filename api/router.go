package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
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

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/metadata/topologies", getTopologies(d))
		r.Get("/metadata/artifact-modes", getArtifactModes(d))
		r.Get("/metadata/reference", getReference(d))

		r.Route("/sessions", func(r chi.Router) {
			r.Get("/", listSessions(d))
			r.Post("/", createSession(d))
			r.Route("/{sessionID}", func(r chi.Router) {
				r.Get("/", getSession(d))
				r.Patch("/", patchSession(d))
				r.Delete("/", deleteSession(d))

				r.Post("/targets", setTargets(d))
				r.Post("/discovery/run", runDiscovery(d))
				r.Get("/discovery", getDiscovery(d))
				r.Post("/discovery/refresh", refreshDiscovery(d))

				r.Get("/configuration", getConfiguration(d))
				r.Put("/configuration", putConfiguration(d))
				r.Post("/configuration/import/yaml", importYAML(d))
				r.Post("/configuration/import/json", importJSON(d))
				r.Get("/configuration/export/yaml", exportYAML(d))
				r.Get("/presets", listPresets(d))
				r.Post("/presets/{presetID}/apply", applyPreset(d))

				r.Post("/validation/run", runValidation(d))
				r.Get("/validation", getValidation(d))

				r.Post("/execution/approve", approveExecution(d))
				r.Post("/execution/start", startExecution(d))
				r.Post("/execution/cancel", cancelExecution(d))
				r.Post("/execution/resume", resumeExecution(d))
				r.Get("/execution/progress", getProgress(d))

				r.Get("/report/completion", getCompletionReport(d))
				r.Get("/report/export", exportSpec(d))
				r.Get("/logs", getLogs(d))
			})
		})
	})

	return r
}
