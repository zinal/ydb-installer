package discovery

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"

	"github.com/ydb-platform/ydb-installer/internal/domain"
)

const (
	defaultSSHPort  = 22
	probeTimeout    = 60 * time.Second
	maxSSHHandshake = 30 * time.Second
)

// SSHDiscoverer collects inventory over SSH (architecture §3.5, FR-DISCOVERY-003).
type SSHDiscoverer struct{}

func (SSHDiscoverer) ProbeHost(ctx context.Context, target domain.TargetHost) (*domain.DiscoveredHost, error) {
	hosts, err := (SSHDiscoverer{}).ProbeAll(ctx, []domain.TargetHost{target})
	if err != nil {
		return nil, err
	}
	if len(hosts) == 0 {
		return nil, errors.New("no probe result")
	}
	return &hosts[0], nil
}

func (d SSHDiscoverer) ProbeAll(ctx context.Context, targets []domain.TargetHost) ([]domain.DiscoveredHost, error) {
	out := make([]domain.DiscoveredHost, 0, len(targets))
	for _, t := range targets {
		h := d.probeOne(ctx, t)
		out = append(out, h)
	}
	return out, nil
}

func (d SSHDiscoverer) probeOne(ctx context.Context, t domain.TargetHost) domain.DiscoveredHost {
	hostID := t.HostID
	if hostID == "" {
		hostID = t.Address
	}
	h := domain.DiscoveredHost{
		HostID:        hostID,
		TargetAddress: strings.TrimSpace(t.Address),
	}

	port := t.Port
	if port <= 0 {
		port = defaultSSHPort
	}
	user := t.User
	if user == "" {
		user = os.Getenv("USER")
		if user == "" {
			user = "root"
		}
	}

	authMethods, closers, err := sshAuthMethods(t.SSHPassword)
	if err != nil {
		h.DiscoveryError = sanitizeProbeErr(err)
		return h
	}
	defer func() {
		for _, c := range closers {
			_ = c.Close()
		}
	}()

	cfg := &ssh.ClientConfig{
		User:            user,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         maxSSHHandshake,
	}

	pctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()

	client, err := dialSSH(pctx, t.Address, port, t.BastionHost, t.BastionUser, cfg)
	if err != nil {
		h.DiscoveryError = sanitizeProbeErr(err)
		return h
	}
	defer func() { _ = client.Close() }()

	if err := d.runMetaSession(pctx, client, &h); err != nil {
		h.DiscoveryError = sanitizeProbeErr(err)
		return h
	}
	if h.DiscoveryError != "" {
		return h
	}

	if raw, err := runRemote(pctx, client, `ip -j addr 2>/dev/null || echo '[]'`); err == nil {
		h.Interfaces = parseIPJSON(json.RawMessage(raw))
	} else {
		h.DiscoveryError = sanitizeProbeErr(err)
		return h
	}

	if raw, err := runRemote(pctx, client, `lsblk -J -b -o NAME,PATH,SIZE,TYPE,MOUNTPOINT,FSTYPE,MODEL 2>/dev/null || echo '{"blockdevices":[]}'`); err == nil {
		h.Disks = parseLsblkJSON(json.RawMessage(strings.TrimSpace(raw)))
	} else {
		h.DiscoveryError = sanitizeProbeErr(err)
		return h
	}

	markSystemAndYDBHints(&h)
	return h
}

// sshSessionClient is implemented by *ssh.Client and bastionWrappedClient.
type sshSessionClient interface {
	NewSession() (*ssh.Session, error)
	Close() error
}

func (d SSHDiscoverer) runMetaSession(ctx context.Context, client sshSessionClient, h *domain.DiscoveredHost) error {
	script := `
set -e
hostname 2>/dev/null || true
hostname -f 2>/dev/null || true
nproc 2>/dev/null || echo 0
grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0
if [ -f /etc/os-release ]; then
  . /etc/os-release 2>/dev/null || true
  echo "OS_NAME=${NAME:-}"
  echo "OS_VER=${VERSION_ID:-}"
fi
timedatectl status 2>/dev/null | head -n 8 || true
`
	out, err := runRemote(ctx, client, script)
	if err != nil {
		return err
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) >= 1 {
		h.Hostname = strings.TrimSpace(lines[0])
	}
	if len(lines) >= 2 {
		h.FQDN = strings.TrimSpace(lines[1])
	}
	if len(lines) >= 3 {
		if n, err := strconv.Atoi(strings.TrimSpace(lines[2])); err == nil {
			h.CPUs = n
		}
	}
	if len(lines) >= 4 {
		if kb, err := strconv.ParseUint(strings.TrimSpace(lines[3]), 10, 64); err == nil {
			h.MemoryBytes = kb * 1024
		}
	}
	for _, line := range lines[4:] {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "OS_NAME=") {
			h.OSName = strings.TrimPrefix(line, "OS_NAME=")
		}
		if strings.HasPrefix(line, "OS_VER=") {
			h.OSVersion = strings.TrimPrefix(line, "OS_VER=")
		}
	}
	var ts []string
	for _, line := range lines[4:] {
		if strings.HasPrefix(line, "OS_NAME=") || strings.HasPrefix(line, "OS_VER=") {
			continue
		}
		if strings.TrimSpace(line) != "" {
			ts = append(ts, line)
		}
	}
	h.TimeSyncHint = strings.Join(ts, "\n")
	return nil
}

func markSystemAndYDBHints(h *domain.DiscoveredHost) {
	if len(h.Disks) == 0 {
		return
	}
	// Heuristic: smallest disk or one mounted at / is likely system disk.
	var rootCandidates []int
	for i := range h.Disks {
		d := &h.Disks[i]
		mp := strings.ToLower(d.Detail)
		if strings.Contains(mp, "mountpoint: /") || strings.Contains(mp, "mountpoint: / ") {
			rootCandidates = append(rootCandidates, i)
		}
	}
	if len(rootCandidates) == 1 {
		h.Disks[rootCandidates[0]].SystemDisk = true
	} else {
		minIdx := -1
		var minSize uint64
		for i := range h.Disks {
			d := h.Disks[i]
			if !strings.Contains(d.Detail, "partition") && d.SizeBytes > 0 {
				if minIdx < 0 || d.SizeBytes < minSize {
					minIdx = i
					minSize = d.SizeBytes
				}
			}
		}
		if minIdx >= 0 {
			h.Disks[minIdx].SystemDisk = true
		}
	}
	for i := range h.Disks {
		d := &h.Disks[i]
		if strings.Contains(strings.ToLower(d.Detail), "ydb") {
			d.HasYDBLabels = true
		}
	}
}

func sanitizeProbeErr(err error) string {
	if err == nil {
		return ""
	}
	s := err.Error()
	if len(s) > 400 {
		s = s[:400] + "…"
	}
	return s
}

func runRemote(ctx context.Context, client sshSessionClient, script string) (string, error) {
	sess, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer func() { _ = sess.Close() }()
	out, err := sess.CombinedOutput(script)
	if ctx.Err() != nil {
		return "", ctx.Err()
	}
	return string(out), err
}

func dialSSH(ctx context.Context, address string, port int, bastionHost, bastionUser string, cfg *ssh.ClientConfig) (sshSessionClient, error) {
	addr := net.JoinHostPort(address, strconv.Itoa(port))
	if bastionHost == "" {
		return sshDialContext(ctx, addr, cfg)
	}

	bUser := bastionUser
	if bUser == "" {
		bUser = cfg.User
	}
	bcfg := *cfg
	bcfg.User = bUser
	bAddr := net.JoinHostPort(bastionHost, strconv.Itoa(defaultSSHPort))
	bc, err := sshDialContext(ctx, bAddr, &bcfg)
	if err != nil {
		return nil, err
	}
	conn, err := bc.Dial("tcp", addr)
	if err != nil {
		_ = bc.Close()
		return nil, err
	}
	ncc, chans, reqs, err := ssh.NewClientConn(conn, addr, cfg)
	if err != nil {
		_ = bc.Close()
		_ = conn.Close()
		return nil, err
	}
	client := ssh.NewClient(ncc, chans, reqs)
	return &bastionWrappedClient{Client: client, bastion: bc}, nil
}

type bastionWrappedClient struct {
	*ssh.Client
	bastion *ssh.Client
}

func (w *bastionWrappedClient) Close() error {
	err := w.Client.Close()
	_ = w.bastion.Close()
	return err
}

func sshDialContext(ctx context.Context, addr string, cfg *ssh.ClientConfig) (*ssh.Client, error) {
	type res struct {
		c   *ssh.Client
		err error
	}
	ch := make(chan res, 1)
	go func() {
		c, err := ssh.Dial("tcp", addr, cfg)
		ch <- res{c, err}
	}()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case r := <-ch:
		return r.c, r.err
	}
}

func sshAuthMethods(sshPassword *string) ([]ssh.AuthMethod, []ioCloser, error) {
	var closers []ioCloser
	var methods []ssh.AuthMethod

	if sshPassword != nil {
		p := strings.TrimSpace(*sshPassword)
		if p != "" {
			methods = append(methods, ssh.Password(p))
		}
	}

	if sock := os.Getenv("SSH_AUTH_SOCK"); sock != "" {
		conn, err := net.Dial("unix", sock)
		if err == nil {
			ag := agent.NewClient(conn)
			methods = append(methods, ssh.PublicKeysCallback(ag.Signers))
			closers = append(closers, conn)
		}
	}

	home, _ := os.UserHomeDir()
	if home == "" {
		home = os.Getenv("HOME")
	}
	keyPaths := []string{
		home + "/.ssh/id_ed25519",
		home + "/.ssh/id_rsa",
	}
	for _, p := range keyPaths {
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		k, err := ssh.ParsePrivateKey(b)
		if err != nil {
			continue
		}
		methods = append(methods, ssh.PublicKeys(k))
	}

	if len(methods) == 0 {
		return nil, closers, errors.New("no SSH credentials: configure password auth, set SSH_AUTH_SOCK, or place a key in ~/.ssh/id_ed25519 or ~/.ssh/id_rsa")
	}
	return methods, closers, nil
}

type ioCloser interface{ Close() error }

func parseIPJSON(raw json.RawMessage) []domain.NetworkInterface {
	if len(raw) == 0 {
		return nil
	}
	var top []struct {
		IfName   string `json:"ifname"`
		AddrInfo []struct {
			Family string `json:"family"`
			Local  string `json:"local"`
		} `json:"addr_info"`
	}
	if err := json.Unmarshal(raw, &top); err != nil {
		return nil
	}
	var out []domain.NetworkInterface
	for _, iface := range top {
		if iface.IfName == "lo" {
			continue
		}
		ni := domain.NetworkInterface{Name: iface.IfName}
		for _, a := range iface.AddrInfo {
			if a.Family != "inet" && a.Family != "inet6" {
				continue
			}
			if a.Local != "" {
				ni.Addrs = append(ni.Addrs, a.Local)
			}
		}
		if ni.Name != "" {
			out = append(out, ni)
		}
	}
	return out
}

func parseLsblkJSON(raw json.RawMessage) []domain.DiscoveredDisk {
	var wrap struct {
		BlockDevices []lsblkNode `json:"blockdevices"`
	}
	if err := json.Unmarshal(raw, &wrap); err != nil {
		return nil
	}
	var disks []domain.DiscoveredDisk
	for _, n := range wrap.BlockDevices {
		disks = append(disks, flattenLsblk("", n)...)
	}
	return disks
}

type lsblkNode struct {
	Name         string      `json:"name"`
	Path         string      `json:"path"`
	Size         json.Number `json:"size"`
	Type         string      `json:"type"`
	Mountpoint   *string     `json:"mountpoint"`
	Fstype       *string     `json:"fstype"`
	Model        *string     `json:"model"`
	Blockdevices []lsblkNode `json:"children"`
}

func flattenLsblk(parent string, n lsblkNode) []domain.DiscoveredDisk {
	var out []domain.DiscoveredDisk
	devicePath := strings.TrimSpace(n.Path)
	if devicePath == "" && n.Name != "" {
		if parent == "" {
			devicePath = "/dev/" + n.Name
		} else {
			devicePath = parent
		}
	}
	switch strings.ToLower(strings.TrimSpace(n.Type)) {
	case "disk":
		d := domain.DiscoveredDisk{DeviceID: devicePath}
		if s, err := n.Size.Int64(); err == nil && s > 0 {
			d.SizeBytes = uint64(s)
		}
		if n.Model != nil {
			d.MediaKind = inferMedia(*n.Model)
		}
		if n.Mountpoint != nil && *n.Mountpoint != "" {
			d.Mounted = true
			d.Detail = "mountpoint: " + *n.Mountpoint
		}
		if n.Fstype != nil && *n.Fstype != "" {
			d.Empty = false
			if d.Detail != "" {
				d.Detail += "; "
			}
			d.Detail += "fstype: " + *n.Fstype
		} else if n.Mountpoint == nil || *n.Mountpoint == "" {
			d.Empty = true
		}
		out = append(out, d)
	case "part":
		d := domain.DiscoveredDisk{DeviceID: devicePath}
		if s, err := n.Size.Int64(); err == nil && s > 0 {
			d.SizeBytes = uint64(s)
		}
		if n.Mountpoint != nil && *n.Mountpoint != "" {
			d.Mounted = true
			d.Detail = "partition; mountpoint: " + *n.Mountpoint
		} else {
			d.Detail = "partition"
		}
		if n.Fstype != nil {
			d.Detail += "; fstype: " + *n.Fstype
		}
		out = append(out, d)
	}
	base := devicePath
	if base == "" && n.Name != "" {
		base = "/dev/" + n.Name
	}
	for _, ch := range n.Blockdevices {
		out = append(out, flattenLsblk(base, ch)...)
	}
	return out
}

func inferMedia(model string) string {
	m := strings.ToLower(model)
	switch {
	case strings.Contains(m, "nvme"):
		return "NVMe"
	case strings.Contains(m, "ssd"):
		return "SSD"
	default:
		return "HDD"
	}
}
