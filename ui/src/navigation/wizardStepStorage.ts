import type { DiscoverySnapshot, InstallationSession } from '@/api/client';

/** Session-scoped UI state for restoring the configuration step (FR-INTERACTIVE-031A). */
export const WIZARD_STEP_STORAGE_KEY = 'ydb-installer.wizard.step';
/** Furthest wizard step index reached (paired with session id); keeps Stepper success markers across remounts. */
export const WIZARD_MAX_REACHED_STORAGE_KEY = 'ydb-installer.wizard.maxReached';
export const DISCOVERY_ACK_STORAGE_KEY = 'ydb-installer.discovery.ack';
export const EXECUTION_STARTED_STORAGE_KEY = 'ydb-installer.execution.started';

type WizardMaxReachedPayload = { sid: string; max: number };

export function readWizardMaxReached(sessionId: string): number {
  try {
    const raw = sessionStorage.getItem(WIZARD_MAX_REACHED_STORAGE_KEY);
    if (!raw) return 0;
    const o = JSON.parse(raw) as WizardMaxReachedPayload;
    if (o.sid !== sessionId || typeof o.max !== 'number' || !Number.isFinite(o.max)) return 0;
    return Math.max(0, Math.min(10, Math.floor(o.max)));
  } catch {
    return 0;
  }
}

export function writeWizardMaxReached(sessionId: string, max: number): void {
  try {
    const clamped = Math.max(0, Math.min(10, Math.floor(max)));
    sessionStorage.setItem(
      WIZARD_MAX_REACHED_STORAGE_KEY,
      JSON.stringify({ sid: sessionId, max: clamped } satisfies WizardMaxReachedPayload),
    );
  } catch {
    /* ignore */
  }
}

export function clearWizardUiState(): void {
  try {
    sessionStorage.removeItem(WIZARD_STEP_STORAGE_KEY);
    sessionStorage.removeItem(WIZARD_MAX_REACHED_STORAGE_KEY);
    sessionStorage.removeItem(DISCOVERY_ACK_STORAGE_KEY);
    sessionStorage.removeItem(EXECUTION_STARTED_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Bounds the wizard index using only persisted session + snapshot + discovery ack (no full draft). */
export function clampStructuralWizardStep(
  step: number,
  session: InstallationSession | undefined,
  snapshot: DiscoverySnapshot | undefined,
): number {
  const status = session?.status;
  if (status === 'validating' || status === 'awaiting_approval') {
    return Math.min(10, Math.max(0, step));
  }

  let ack = false;
  try {
    ack = sessionStorage.getItem(DISCOVERY_ACK_STORAGE_KEY) === '1';
  } catch {
    /* ignore */
  }
  let max = 10;
  if (!session?.targets?.length) max = 0;
  else if (!snapshot?.collectedAt) max = 1;
  else if (!ack) max = 2;
  return Math.min(max, Math.max(0, step));
}
