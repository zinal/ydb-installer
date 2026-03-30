//go:build production

package main

import (
	"crypto/tls"
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ydb-platform/ydb-installer/internal/security"
)

var (
	tlsPEMPath string
	tlsSANRaw  string
)

func init() {
	flag.StringVar(&tlsPEMPath, "tls-pem", "", "path to combined PEM (private key, leaf certificate, optional CA chain); default is <data-dir>/web.pem")
	flag.StringVar(&tlsSANRaw, "tls-san", "localhost,127.0.0.1", "comma-separated DNS names or IPs for Subject Alternative Names when generating a self-signed certificate")
}

func runServer(addr, dataDir string, handler http.Handler) {
	pemPath := tlsPEMPath
	if pemPath == "" {
		pemPath = filepath.Join(dataDir, "web.pem")
	}
	if v := strings.TrimSpace(os.Getenv("YDB_INSTALLER_TLS_PEM")); v != "" {
		pemPath = v
	}

	cert, err := loadOrCreateCert(pemPath)
	if err != nil {
		log.Fatalf("tls: %v", err)
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		TLSConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
			NextProtos: []string{"h2", "http/1.1"},
			Certificates: []tls.Certificate{*cert},
		},
	}
	go func() {
		log.Printf("listening on %s (HTTPS)", addr)
		if err := srv.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	shutdownGracefully(srv)
}

func loadOrCreateCert(pemPath string) (*tls.Certificate, error) {
	if _, err := os.Stat(pemPath); err == nil {
		c, err := security.LoadTLSFromCombinedPEM(pemPath)
		if err != nil {
			return nil, err
		}
		log.Printf("tls: using certificate from %s", pemPath)
		return c, nil
	} else if !os.IsNotExist(err) {
		return nil, err
	}

	hosts := splitSANs(tlsSANRaw)
	pem, err := security.GenerateSelfSignedWebPEM(hosts)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(pemPath), 0o700); err != nil {
		return nil, err
	}
	if err := security.WriteFileExclusive(pemPath, pem, 0o600); err != nil {
		if _, e := os.Stat(pemPath); e == nil {
			c, err2 := security.LoadTLSFromCombinedPEM(pemPath)
			if err2 != nil {
				return nil, err2
			}
			log.Printf("tls: using certificate from %s", pemPath)
			return c, nil
		}
		return nil, err
	}
	log.Printf("tls: wrote self-signed certificate to %s", pemPath)
	c, err := security.TLSFromPEMBytes(pem)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func splitSANs(raw string) []string {
	var out []string
	for _, p := range strings.Split(raw, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
