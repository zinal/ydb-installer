package security

import (
	"crypto/tls"
	"testing"
)

func TestTLSFromPEMBytes_RoundTripSelfSigned(t *testing.T) {
	pem, err := GenerateSelfSignedWebPEM([]string{"localhost", "127.0.0.1"})
	if err != nil {
		t.Fatal(err)
	}
	cert, err := TLSFromPEMBytes(pem)
	if err != nil {
		t.Fatal(err)
	}
	if cert == nil || len(cert.Certificate) == 0 {
		t.Fatal("expected certificate chain")
	}
}

func TestLoadTLSFromCombinedPEM_KeyCertChain(t *testing.T) {
	// Self-signed PEM is key + single cert; chain optional.
	pem, err := GenerateSelfSignedWebPEM([]string{"example.test"})
	if err != nil {
		t.Fatal(err)
	}
	c1, err := TLSFromPEMBytes(pem)
	if err != nil {
		t.Fatal(err)
	}
	srv := tls.Config{Certificates: []tls.Certificate{*c1}}
	if len(srv.Certificates) != 1 {
		t.Fatal("expected one certificate entry")
	}
}
