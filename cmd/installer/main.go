package main

import (
	"context"
	"embed"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ydb-platform/ydb-installer/api"
	appstub "github.com/ydb-platform/ydb-installer/app/stub"
)

//go:embed all:web
var web embed.FS

func main() {
	addr := flag.String("listen", ":8443", "HTTP listen address")
	flag.Parse()

	svc := &appstub.Services{}
	deps := api.Deps{
		Sessions:      svc,
		Discovery:     svc,
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
