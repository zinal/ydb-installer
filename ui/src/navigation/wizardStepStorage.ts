import type { DiscoverySnapshot, InstallationSession } from '@/api/client';

/** Number of wizard steps minus one (0-based max index). */
export const WIZARD_LAST_STEP_INDEX = 9;

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
    return Math.max(0, Math.min(WIZARD_LAST_STEP_INDEX, Math.floor(o.max)));
  } catch {
    return 0;
  }
}

export function writeWizardMaxReached(sessionId: string, max: number): void {
  try {
    const clamped = Math.max(0, Math.min(WIZARD_LAST_STEP_INDEX, Math.floor(max)));
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

/**
 * Migrates persisted step index from the pre-merge 11-step wizard (0–10) to the current
 * 10-step wizard (0–9): former steps 3–10 map down by one; old step 2 (discovery results)
 * maps to step 1 (merged discovery).
 */
export function migrateLegacyWizardStepIndex(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const n = Math.floor(raw);
  if (n < 0) return 0;
  if (n <= 1) return Math.min(WIZARD_LAST_STEP_INDEX, n);
  if (n === 2) return 1;
  if (n <= 10) return Math.min(WIZARD_LAST_STEP_INDEX, n - 1);
  return WIZARD_LAST_STEP_INDEX;
}

/** Bounds the wizard index using only persisted session + snapshot + discovery ack (no full draft). */
export function clampStructuralWizardStep(
  step: number,
  session: InstallationSession | undefined,
  snapshot: DiscoverySnapshot | undefined,
): number {
  const status = session?.status;
  if (status === 'validating' || status === 'awaiting_approval') {
    return Math.min(WIZARD_LAST_STEP_INDEX, Math.max(0, step));
  }

  let ack = false;
  try {
    ack = sessionStorage.getItem(DISCOVERY_ACK_STORAGE_KEY) === '1';
  } catch {
    /* ignore */
  }
  let max = WIZARD_LAST_STEP_INDEX;
  if (!session?.targets?.length) max = 0;
  else if (!snapshot?.collectedAt) max = 1;
  else if (!ack) max = 1;
  return Math.min(max, Math.max(0, step));
}
