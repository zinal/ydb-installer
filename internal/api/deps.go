package api

import (
	"github.com/ydb-platform/ydb-installer/internal/app"
	"github.com/ydb-platform/ydb-installer/internal/domain"
	"github.com/ydb-platform/ydb-installer/internal/security"
)

// Deps wires application services into HTTP handlers.
type Deps struct {
	Mode          domain.InstallationMode
	Auth          *security.SessionAuth
	Sessions      app.SessionService
	Discovery     app.DiscoveryService
	Configuration app.ConfigurationService
	Validation    app.ValidationService
	Execution     app.ExecutionCoordinator
	Reporting     app.ReportingService
	Metadata      app.MetadataService
}
