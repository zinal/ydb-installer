//go:build !production

package main

import (
	"log"
	"net/http"
	"time"
)

func runServer(addr, dataDir string, handler http.Handler) {
	_ = dataDir
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		log.Printf("listening on %s (HTTP, dev build without TLS)", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	shutdownGracefully(srv)
}
