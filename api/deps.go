package api

import (
	"github.com/ydb-platform/ydb-installer/app"
	"github.com/ydb-platform/ydb-installer/domain"
	"github.com/ydb-platform/ydb-installer/security"
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
