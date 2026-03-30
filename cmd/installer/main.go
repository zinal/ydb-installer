package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/ydb-platform/ydb-installer/internal/domain"
	sqlitestore "github.com/ydb-platform/ydb-installer/internal/storage/sqlite"
)

func main() {
	addr := flag.String("listen", ":8443", "listen address (HTTPS in production builds)")
	dataDir := flag.String("data-dir", defaultDataDir(), "writable directory for SQLite state and generated TLS material")
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

	handler := buildHandler(mode, operatorPassword, observerPassword, st)
	runServer(*addr, *dataDir, handler)
}

func defaultDataDir() string {
	if d := os.Getenv("YDB_INSTALLER_DATA_DIR"); d != "" {
		return d
	}
	return filepath.Join(".", "data")
}

func optionalEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
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

func shutdownGracefully(srv shutdowner) {
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

type shutdowner interface {
	Shutdown(ctx context.Context) error
}
