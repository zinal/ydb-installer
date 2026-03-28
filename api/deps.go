package api

import "github.com/ydb-platform/ydb-installer/app"

// Deps wires application services into HTTP handlers.
type Deps struct {
	Sessions      app.SessionService
	Discovery     app.DiscoveryService
	Configuration app.ConfigurationService
	Validation    app.ValidationService
	Execution     app.ExecutionCoordinator
	Reporting     app.ReportingService
	Metadata      app.MetadataService
}
