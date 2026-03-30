package main

import (
	"embed"
	"net/http"

	"github.com/ydb-platform/ydb-installer/internal/api"
	discoverysvc "github.com/ydb-platform/ydb-installer/internal/app/discovery"
	"github.com/ydb-platform/ydb-installer/internal/app/session"
	appstub "github.com/ydb-platform/ydb-installer/internal/app/stub"
	"github.com/ydb-platform/ydb-installer/internal/domain"
	"github.com/ydb-platform/ydb-installer/internal/security"
	sqlitestore "github.com/ydb-platform/ydb-installer/internal/storage/sqlite"
)

//go:embed all:web
var web embed.FS

func buildHandler(mode domain.InstallationMode, operatorPassword, observerPassword string, st *sqlitestore.Store) http.Handler {
	sessSvc := &session.Service{Store: st}
	discSvc := &discoverysvc.Service{Store: st}
	auth := security.NewSessionAuth(security.AuthConfig{
		Mode:             mode,
		OperatorPassword: operatorPassword,
		ObserverPassword: observerPassword,
	})
	svc := appstub.NewServices(st)
	deps := api.Deps{
		Mode:          mode,
		Auth:          auth,
		Sessions:      sessSvc,
		Discovery:     discSvc,
		Configuration: svc,
		Validation:    svc,
		Execution:     svc,
		Reporting:     svc,
		Metadata:      svc,
	}
	router := api.NewRouter(deps)
	return api.NewServer(router, web)
}
