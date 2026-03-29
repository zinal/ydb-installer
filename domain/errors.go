package domain

import "errors"

var (
	ErrNotImplemented = errors.New("not implemented")
	ErrNotFound       = errors.New("not found")
	ErrUnauthorized   = errors.New("unauthorized")
	ErrObserverDisabled = errors.New("observer authentication is disabled")
	ErrForbidden      = errors.New("forbidden")
	ErrConflict       = errors.New("conflict")
	ErrValidation     = errors.New("validation failed")
)
