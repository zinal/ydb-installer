package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/ydb-platform/ydb-installer/internal/app"
	"github.com/ydb-platform/ydb-installer/internal/domain"
)

func parseSessionID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	s := chi.URLParam(r, "sessionID")
	id, err := uuid.Parse(s)
	if err != nil {
		writeAPIError(w, domain.ErrValidation)
		return uuid.Nil, false
	}
	return id, true
}

func listSessions(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
		if limit <= 0 {
			limit = 50
		}
		list, err := d.Sessions.List(r.Context(), limit, offset)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	}
}

func createSession(d Deps) http.HandlerFunc {
	type body struct {
		Mode  domain.InstallationMode `json:"mode"`
		Title string                  `json:"title,omitempty"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var b body
		if err := readJSON(r, &b); err != nil {
			writeAPIError(w, domain.ErrValidation)
			return
		}
		b.Mode = d.Mode
		sess, err := d.Sessions.Create(r.Context(), b.Mode, b.Title)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, sess)
	}
}

func getSession(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		sess, err := d.Sessions.Get(r.Context(), id)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, sess)
	}
}

func patchSession(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		var patch app.SessionDraftPatch
		if err := readJSON(r, &patch); err != nil {
			writeAPIError(w, domain.ErrValidation)
			return
		}
		if err := d.Sessions.UpdateDraft(r.Context(), id, patch); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteSession(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		if err := d.Sessions.Delete(r.Context(), id); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func resetInstallationState(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := d.Sessions.ResetInstallationState(r.Context()); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func setTargets(d Deps) http.HandlerFunc {
	type body struct {
		Targets []domain.TargetHost `json:"targets"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		var b body
		if err := readJSON(r, &b); err != nil {
			writeAPIError(w, domain.ErrValidation)
			return
		}
		if err := d.Discovery.SetTargets(r.Context(), id, b.Targets); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func runDiscovery(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		if err := d.Discovery.RunDiscovery(r.Context(), id); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}
}

func getDiscovery(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		snap, err := d.Discovery.GetSnapshot(r.Context(), id)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, snap)
	}
}

func getConfiguration(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		cfg, err := d.Configuration.GetConfiguration(r.Context(), id)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, cfg)
	}
}

func putConfiguration(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		var layout domain.ClusterLayout
		if err := readJSON(r, &layout); err != nil {
			writeAPIError(w, domain.ErrValidation)
			return
		}
		if err := d.Configuration.PutConfiguration(r.Context(), id, layout); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func importYAML(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		if err := d.Configuration.ImportYAML(r.Context(), id, r.Body); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func importJSON(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		if err := d.Configuration.ImportJSON(r.Context(), id, r.Body); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func exportYAML(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		w.Header().Set("Content-Type", "application/x-yaml; charset=utf-8")
		if err := d.Configuration.ExportYAML(r.Context(), id, w); err != nil {
			writeAPIError(w, err)
			return
		}
	}
}

func listPresets(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		presets, err := d.Configuration.ListPresets(r.Context())
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, presets)
	}
}

func applyPreset(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		presetID := chi.URLParam(r, "presetID")
		if err := d.Configuration.ApplyPreset(r.Context(), id, presetID); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func runValidation(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		rep, err := d.Validation.RunPreflight(r.Context(), id)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, rep)
	}
}

func getValidation(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		rep, err := d.Validation.GetReport(r.Context(), id)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, rep)
	}
}

func approveExecution(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		if err := d.Execution.RequestApproval(r.Context(), id); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func startExecution(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		if err := d.Execution.StartExecution(r.Context(), id); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}
}

func cancelExecution(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		if err := d.Execution.Cancel(r.Context(), id); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}
}

func resumeExecution(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		if err := d.Execution.Resume(r.Context(), id); err != nil {
			writeAPIError(w, err)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}
}

func getProgress(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		p, err := d.Execution.GetProgress(r.Context(), id)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func getCompletionReport(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		rep, err := d.Reporting.GetCompletionReport(r.Context(), id)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, rep)
	}
}

func exportSpec(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		format := r.URL.Query().Get("format")
		if format == "" {
			format = "yaml"
		}
		if err := d.Reporting.ExportEffectiveSpec(r.Context(), id, w, format); err != nil {
			writeAPIError(w, err)
			return
		}
	}
}

func getLogs(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		tail, _ := strconv.Atoi(r.URL.Query().Get("tail"))
		if tail <= 0 {
			tail = 200
		}
		lines, err := d.Reporting.GetLogs(r.Context(), id, tail)
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, struct {
			Lines []string `json:"lines"`
		}{Lines: lines})
	}
}

// Metadata handlers
func getTopologies(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		v, err := d.Metadata.SupportedTopologies(r.Context())
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, v)
	}
}

func getArtifactModes(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		v, err := d.Metadata.SupportedArtifactModes(r.Context())
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, v)
	}
}

func getReference(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		v, err := d.Metadata.ReferenceIndex(r.Context())
		if err != nil {
			writeAPIError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, v)
	}
}

func getRuntime(d Deps) http.HandlerFunc {
	type runtimeResponse struct {
		Mode domain.InstallationMode `json:"mode"`
	}
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, runtimeResponse{Mode: d.Mode})
	}
}
