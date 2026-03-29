package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

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
	operatorPassword, err := requiredEnv("YDB_INSTALLER_OPERATOR_PASSWORD")
	if err != nil {
		log.Fatal(err)
	}
	observerPassword := optionalEnv("YDB_INSTALLER_OBSERVER_PASSWORD")
	if observerPassword == "" {
		log.Printf("observer authentication: disabled (YDB_INSTALLER_OBSERVER_PASSWORD is not set)")
	} else {
		log.Printf("observer authentication: enabled")
	}
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

func optionalEnv(key string) string {
	v := strings.TrimSpace(os.Getenv(key))
	return v
}

func requiredEnv(key string) (string, error) {
	v := optionalEnv(key)
	if v == "" {
		return "", fmt.Errorf("%s must be set", key)
	}
	return v, nil
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
