package discovery

import "testing"

func TestSSHDialHostOnly(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"", ""},
		{"myhost", "myhost"},
		{"myhost:2222", "myhost"},
		{"10.0.0.1:2222", "10.0.0.1"},
		{"[2001:db8::1]:2222", "2001:db8::1"},
	}
	for _, tc := range tests {
		got := sshDialHostOnly(tc.in)
		if got != tc.want {
			t.Errorf("sshDialHostOnly(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
