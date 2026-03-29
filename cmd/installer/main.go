package main

import (
	"context"
	"embed"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/ydb-platform/ydb-installer/api"
	discoverysvc "github.com/ydb-platform/ydb-installer/app/discovery"
	"github.com/ydb-platform/ydb-installer/app/session"
	appstub "github.com/ydb-platform/ydb-installer/app/stub"
	"github.com/ydb-platform/ydb-installer/domain"
	"github.com/ydb-platform/ydb-installer/security"
	sqlitestore "github.com/ydb-platform/ydb-installer/storage/sqlite"
)

//go:embed all:web
var web embed.FS

func main() {
	addr := flag.String("listen", ":8443", "HTTP listen address")
	dataDir := flag.String("data-dir", defaultDataDir(), "writable directory for SQLite state")
	modeFlag := flag.String("mode", defaultMode(), "installer mode: interactive|batch")
	flag.Parse()

	if err := os.MkdirAll(*dataDir, 0o700); err != nil {
		log.Fatalf("data-dir: %v", err)
	}
	dbPath := filepath.Join(*dataDir, "installer.db")
	st, err := sqlitestore.Open(dbPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer func() { _ = st.Close() }()

	sessSvc := &session.Service{Store: st}
	discSvc := &discoverysvc.Service{Store: st}
	mode := parseMode(*modeFlag)
	auth := security.NewSessionAuth(security.AuthConfig{
		Mode:             mode,
		OperatorPassword: envOrDefault("YDB_INSTALLER_OPERATOR_PASSWORD", "operator"),
		ObserverPassword: envOrDefault("YDB_INSTALLER_OBSERVER_PASSWORD", "observer"),
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
	handler := api.NewServer(router, web)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("listening on %s", *addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func defaultDataDir() string {
	if d := os.Getenv("YDB_INSTALLER_DATA_DIR"); d != "" {
		return d
	}
	return filepath.Join(".", "data")
}

func envOrDefault(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func defaultMode() string {
	if v := strings.TrimSpace(os.Getenv("YDB_INSTALLER_MODE")); v != "" {
		return v
	}
	return string(domain.ModeInteractive)
}

func parseMode(raw string) domain.InstallationMode {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(domain.ModeBatch):
		return domain.ModeBatch
	default:
		return domain.ModeInteractive
	}
}
