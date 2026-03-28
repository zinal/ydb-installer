import type { DiscoverySnapshot, InstallationSession } from '@/api/client';
import { clampStructuralWizardStep, WIZARD_STEP_STORAGE_KEY } from './wizardStepStorage';

/**
 * Resolves the post-login route from persisted session status (domain.SessionStatus),
 * discovery snapshot, and last saved wizard step (§6.4, §6.5).
 */
export function resolvePostLoginDestination(
  session: InstallationSession,
  snapshot: DiscoverySnapshot | undefined,
): string {
  const status = session.status;

  if (status === 'running' || status === 'cancel_requested') {
    return '/monitoring';
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    return '/results';
  }

  if (status === 'validating' || status === 'awaiting_approval') {
    return '/configuration?step=9';
  }

  let saved: number | null = null;
  try {
    const raw = sessionStorage.getItem(WIZARD_STEP_STORAGE_KEY);
    if (raw != null) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) saved = n;
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
    rawStep = Math.max(rawStep, 2);
  }

  if (status === 'discovery_ready') {
    rawStep = Math.max(rawStep, snapshot?.collectedAt ? 2 : 1);
  }
  if (status === 'configuring') {
    rawStep = Math.max(rawStep, 3);
  }

  rawStep = Math.min(10, Math.max(0, rawStep));
  const step = clampStructuralWizardStep(rawStep, session, snapshot);
  return `/configuration?step=${step}`;
}

function defaultStepFromStatus(status: string): number {
  switch (status) {
    case 'discovery_ready':
      return 1;
    case 'configuring':
      return 3;
    case 'draft':
    default:
      return 0;
  }
}
