export type TargetFormRow = {
  /** Hostname or IP (no port; use sshPort). */
  address: string;
  /** SSH TCP port for this target when not using default authentication. */
  sshPort: number;
  /** Required per row (§6.6.1). */
  user: string;
  /** Row override when auth mode is password; not sent on the public API (FR-SECURITY-008). */
  sshPassword?: string;
  /** Prototype: secret-key file chosen for the row. */
  sshKeySelected?: boolean;
};

export type TargetsForm = { targets: TargetFormRow[] };
