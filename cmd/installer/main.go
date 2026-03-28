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
	"syscall"
	"time"

	"github.com/ydb-platform/ydb-installer/api"
	discoverysvc "github.com/ydb-platform/ydb-installer/app/discovery"
	"github.com/ydb-platform/ydb-installer/app/session"
	appstub "github.com/ydb-platform/ydb-installer/app/stub"
	sqlitestore "github.com/ydb-platform/ydb-installer/storage/sqlite"
)

//go:embed all:web
var web embed.FS

func main() {
	addr := flag.String("listen", ":8443", "HTTP listen address")
	dataDir := flag.String("data-dir", defaultDataDir(), "writable directory for SQLite state")
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

	svc := &appstub.Services{}
	deps := api.Deps{
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
