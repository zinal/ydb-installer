export type TargetFormRow = {
  /** Hostname, IP, or `host:port` (port defaults to SSH default when omitted). */
  address: string;
  /** Required per row (§6.6.1). */
  user: string;
  /** Row override when auth mode is password; not sent on the public API (FR-SECURITY-008). */
  sshPassword?: string;
  /** Prototype: secret-key file chosen for the row. */
  sshKeySelected?: boolean;
};

export type TargetsForm = { targets: TargetFormRow[] };
