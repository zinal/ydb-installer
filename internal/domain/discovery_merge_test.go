package domain

import "testing"

func TestMergeTargetHosts_PreservesPasswordWhenOmitted(t *testing.T) {
	pass := "secret"
	prev := []TargetHost{
		{Address: "host-a", Port: 22, User: "u", SSHPassword: &pass},
	}
	incoming := []TargetHost{
		{Address: "host-a", Port: 22, User: "u", SSHPassword: nil},
	}
	got := MergeTargetHosts(prev, incoming)
	if got[0].SSHPassword == nil || *got[0].SSHPassword != "secret" {
		t.Fatalf("want preserved password, got %#v", got[0].SSHPassword)
	}
}

func TestMergeTargetHosts_UsesNewPasswordWhenProvided(t *testing.T) {
	oldp, newp := "old", "new"
	prev := []TargetHost{
		{Address: "host-a", Port: 22, SSHPassword: &oldp},
	}
	incoming := []TargetHost{
		{Address: "host-a", Port: 22, SSHPassword: &newp},
	}
	got := MergeTargetHosts(prev, incoming)
	if got[0].SSHPassword == nil || *got[0].SSHPassword != "new" {
		t.Fatalf("want new password")
	}
}

func TestMergeTargetHosts_NoMergeWhenHostKeyChanges(t *testing.T) {
	pass := "secret"
	prev := []TargetHost{
		{Address: "host-a", Port: 22, SSHPassword: &pass},
	}
	incoming := []TargetHost{
		{Address: "host-b", Port: 22, SSHPassword: nil},
	}
	got := MergeTargetHosts(prev, incoming)
	if got[0].SSHPassword != nil {
		t.Fatal("should not carry password to different host")
	}
}

func TestMergeTargetHosts_ExplicitEmptyClearsPassword(t *testing.T) {
	pass := "secret"
	empty := ""
	prev := []TargetHost{
		{Address: "host-a", Port: 22, SSHPassword: &pass},
	}
	incoming := []TargetHost{
		{Address: "host-a", Port: 22, SSHPassword: &empty},
	}
	got := MergeTargetHosts(prev, incoming)
	if got[0].SSHPassword != nil {
		t.Fatal("want cleared password")
	}
}
