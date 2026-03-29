package api

import (
	"encoding/json"
	"net/http"

	"github.com/ydb-platform/ydb-installer/domain"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeAPIError(w http.ResponseWriter, err error) {
	code := http.StatusInternalServerError
	switch err {
	case domain.ErrNotFound:
		code = http.StatusNotFound
	case domain.ErrUnauthorized:
		code = http.StatusUnauthorized
	case domain.ErrObserverDisabled:
		code = http.StatusForbidden
	case domain.ErrForbidden:
		code = http.StatusForbidden
	case domain.ErrConflict:
		code = http.StatusConflict
	case domain.ErrValidation:
		code = http.StatusBadRequest
	}
	type errBody struct {
		Error string `json:"error"`
	}
	writeJSON(w, code, errBody{Error: err.Error()})
}

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}
