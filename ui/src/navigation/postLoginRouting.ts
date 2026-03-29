import type { DiscoverySnapshot, InstallationSession } from '@/api/client';
import {
  clampStructuralWizardStep,
  migrateLegacyWizardStepIndex,
  WIZARD_STEP_STORAGE_KEY,
} from './wizardStepStorage';

/**
 * Resolves the post-login route from persisted session status (domain.SessionStatus),
 * discovery snapshot, and last saved wizard step (§6.4, §6.5).
 */
export function resolvePostLoginDestination(
  session: InstallationSession,
  snapshot: DiscoverySnapshot | undefined,
): string {
  if (session.mode === 'batch') {
    return '/configuration?step=9';
  }
  const status = session.status;

  if (status === 'running' || status === 'cancel_requested') {
    return '/monitoring';
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    return '/results';
  }

  if (status === 'validating' || status === 'awaiting_approval') {
    return '/configuration?step=8';
  }

  let saved: number | null = null;
  try {
    const raw = sessionStorage.getItem(WIZARD_STEP_STORAGE_KEY);
    if (raw != null) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) saved = migrateLegacyWizardStepIndex(n);
    }
  } catch {
    /* ignore */
  }

  let rawStep = saved ?? defaultStepFromStatus(status);

  if (!session.targets?.length) {
    rawStep = 0;
  } else if (!snapshot?.collectedAt) {
    rawStep = Math.min(Math.max(rawStep, 0), 1);
  } else {
    rawStep = Math.max(rawStep, 1);
  }

  if (status === 'discovery_ready') {
    rawStep = Math.max(rawStep, 1);
  }
  if (status === 'configuring') {
    rawStep = Math.max(rawStep, 2);
  }

  rawStep = Math.min(9, Math.max(0, rawStep));
  const step = clampStructuralWizardStep(rawStep, session, snapshot);
  return `/configuration?step=${step}`;
}

function defaultStepFromStatus(status: string): number {
  switch (status) {
    case 'discovery_ready':
      return 1;
    case 'configuring':
      return 2;
    case 'draft':
    default:
      return 0;
  }
}
