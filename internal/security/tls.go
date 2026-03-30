package security

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"strings"
	"time"
)

// TLSLoadError is returned when PEM material cannot be used for HTTPS.
type TLSLoadError struct {
	Msg string
}

func (e *TLSLoadError) Error() string { return e.Msg }

// LoadTLSFromCombinedPEM reads a PEM file containing a private key and one or more
// certificates (leaf first, then optional CA chain), as commonly produced by
// concatenating key, cert, and intermediates into a single file (e.g. web.pem).
func LoadTLSFromCombinedPEM(path string) (*tls.Certificate, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return TLSFromPEMBytes(raw)
}

// TLSFromPEMBytes builds a tls.Certificate from PEM-encoded key and certificate chain.
func TLSFromPEMBytes(raw []byte) (*tls.Certificate, error) {
	var keyDER []byte
	var keyType string
	var certBlocks [][]byte

	for {
		var rest []byte
		var block *pem.Block
		block, rest = pem.Decode(raw)
		if block == nil {
			break
		}
		raw = rest
		switch block.Type {
		case "CERTIFICATE":
			certBlocks = append(certBlocks, block.Bytes)
		case "RSA PRIVATE KEY", "PRIVATE KEY", "EC PRIVATE KEY":
			if keyDER != nil {
				return nil, &TLSLoadError{Msg: "multiple private keys in PEM"}
			}
			keyDER = block.Bytes
			keyType = block.Type
		default:
			// Ignore unrelated PEM sections (e.g. old PKCS#7 wrappers) rather than failing.
		}
	}
	if len(certBlocks) == 0 {
		return nil, &TLSLoadError{Msg: "no CERTIFICATE blocks found in PEM"}
	}
	if keyDER == nil {
		return nil, &TLSLoadError{Msg: "no private key found in PEM"}
	}

	leaf, err := x509.ParseCertificate(certBlocks[0])
	if err != nil {
		return nil, fmt.Errorf("parse leaf certificate: %w", err)
	}

	priv, err := parsePrivateKey(keyType, keyDER)
	if err != nil {
		return nil, err
	}
	if err := leafMatchesKey(leaf, priv); err != nil {
		return nil, err
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certBlocks[0]})
	var chainPEM []byte
	for i := 1; i < len(certBlocks); i++ {
		chainPEM = append(chainPEM, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certBlocks[i]})...)
	}
	keyPEM, err := marshalPrivateKeyPEM(priv)
	if err != nil {
		return nil, err
	}
	cert, err := tls.X509KeyPair(append(certPEM, chainPEM...), keyPEM)
	if err != nil {
		return nil, fmt.Errorf("build tls certificate: %w", err)
	}
	return &cert, nil
}

func parsePrivateKey(keyType string, der []byte) (any, error) {
	// Prefer generic PKCS#8 / PKCS#1 / EC parsing.
	if k, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		return k, nil
	}
	if k, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return k, nil
	}
	if k, err := x509.ParseECPrivateKey(der); err == nil {
		return k, nil
	}
	if keyType == "RSA PRIVATE KEY" {
		return nil, &TLSLoadError{Msg: "invalid RSA private key PEM"}
	}
	return nil, &TLSLoadError{Msg: "unsupported or invalid private key PEM"}
}

func marshalPrivateKeyPEM(priv any) ([]byte, error) {
	switch k := priv.(type) {
	case *rsa.PrivateKey:
		return pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(k)}), nil
	case *ecdsa.PrivateKey:
		b, err := x509.MarshalECPrivateKey(k)
		if err != nil {
			return nil, err
		}
		return pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: b}), nil
	case ed25519.PrivateKey:
		b, err := x509.MarshalPKCS8PrivateKey(k)
		if err != nil {
			return nil, err
		}
		return pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: b}), nil
	default:
		return nil, &TLSLoadError{Msg: "unsupported private key type"}
	}
}

func leafMatchesKey(leaf *x509.Certificate, priv any) error {
	switch pub := leaf.PublicKey.(type) {
	case *rsa.PublicKey:
		k, ok := priv.(*rsa.PrivateKey)
		if !ok || k.PublicKey.N.Cmp(pub.N) != 0 {
			return &TLSLoadError{Msg: "private key does not match leaf certificate (RSA)"}
		}
	case *ecdsa.PublicKey:
		k, ok := priv.(*ecdsa.PrivateKey)
		if !ok || k.PublicKey.X.Cmp(pub.X) != 0 || k.PublicKey.Y.Cmp(pub.Y) != 0 {
			return &TLSLoadError{Msg: "private key does not match leaf certificate (ECDSA)"}
		}
	case ed25519.PublicKey:
		k, ok := priv.(ed25519.PrivateKey)
		if !ok {
			return &TLSLoadError{Msg: "private key does not match leaf certificate (Ed25519)"}
		}
		if len(k) != ed25519.PrivateKeySize {
			return &TLSLoadError{Msg: "invalid Ed25519 private key size"}
		}
		if !pub.Equal(k.Public().(ed25519.PublicKey)) {
			return &TLSLoadError{Msg: "private key does not match leaf certificate (Ed25519)"}
		}
	default:
		return &TLSLoadError{Msg: "unsupported public key algorithm in leaf certificate"}
	}
	return nil
}

// GenerateSelfSignedWebPEM creates a new ECDSA P-256 certificate and key for HTTPS,
// valid for approximately one year, with DNS SAN localhost and optional extra names.
// The PEM combines private key, leaf certificate, and no chain (self-signed).
func GenerateSelfSignedWebPEM(hosts []string) ([]byte, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, err
	}
	names := uniqueHosts(hosts)
	if len(names) == 0 {
		names = []string{"localhost"}
	}
	var dnsNames []string
	var ipAddrs []net.IP
	for _, h := range names {
		if ip := net.ParseIP(h); ip != nil {
			ipAddrs = append(ipAddrs, ip)
		} else {
			dnsNames = append(dnsNames, h)
		}
	}
	if len(dnsNames) == 0 && len(ipAddrs) == 0 {
		dnsNames = []string{"localhost"}
	}
	cn := "localhost"
	if len(dnsNames) > 0 {
		cn = dnsNames[0]
	} else if len(ipAddrs) > 0 {
		cn = ipAddrs[0].String()
	}
	tpl := x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			Organization: []string{"YDB Installer"},
			CommonName:   cn,
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              dnsNames,
		IPAddresses:           ipAddrs,
	}
	der, err := x509.CreateCertificate(rand.Reader, &tpl, &tpl, &key.PublicKey, key)
	if err != nil {
		return nil, err
	}
	var buf strings.Builder
	if err := encodePrivateKeyPEM(&buf, key); err != nil {
		return nil, err
	}
	_ = pem.Encode(&buf, &pem.Block{Type: "CERTIFICATE", Bytes: der})
	return []byte(buf.String()), nil
}

func encodePrivateKeyPEM(w io.Writer, key *ecdsa.PrivateKey) error {
	b, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return err
	}
	return pem.Encode(w, &pem.Block{Type: "EC PRIVATE KEY", Bytes: b})
}

func uniqueHosts(hosts []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, h := range hosts {
		h = strings.TrimSpace(h)
		if h == "" {
			continue
		}
		if _, ok := seen[h]; ok {
			continue
		}
		seen[h] = struct{}{}
		out = append(out, h)
	}
	return out
}

// WriteFileExclusive writes data to path with mode 0600, failing if path exists (no overwrite).
func WriteFileExclusive(path string, data []byte, perm os.FileMode) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, perm)
	if err != nil {
		if errors.Is(err, os.ErrExist) {
			return fmt.Errorf("refusing to overwrite existing file: %s", path)
		}
		return err
	}
	_, werr := f.Write(data)
	cerr := f.Close()
	if werr != nil {
		_ = os.Remove(path)
		return werr
	}
	if cerr != nil {
		_ = os.Remove(path)
		return cerr
	}
	return nil
}
