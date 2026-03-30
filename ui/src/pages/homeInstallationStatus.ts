import type { InstallationSession, SessionPhase } from '@/api/client';
import { t } from '@/i18n';

type TFn = typeof t;

/** Maps persisted session.status to UI copy (domain.SessionStatus). */
export function sessionStatusLabel(status: string | undefined, tt: TFn): string {
  if (!status) return tt('home.status.unknown');
  switch (status) {
    case 'draft':
      return tt('home.status.draft');
    case 'discovery_ready':
      return tt('home.status.discovery_ready');
    case 'configuring':
      return tt('home.status.configuring');
    case 'validating':
      return tt('home.status.validating');
    case 'awaiting_approval':
      return tt('home.status.awaiting_approval');
    case 'running':
      return tt('home.status.running');
    case 'cancel_requested':
      return tt('home.status.cancel_requested');
    case 'completed':
      return tt('home.status.completed');
    case 'failed':
      return tt('home.status.failed');
    case 'cancelled':
      return tt('home.status.cancelled');
    default:
      return status;
  }
}

/** Maps API phase name (domain PhaseName) to a short label. */
export function phaseStateLabel(state: string | undefined, tt: TFn): string {
  if (!state) return '';
  switch (state) {
    case 'pending':
      return tt('home.phaseState.pending');
    case 'running':
      return tt('home.phaseState.running');
    case 'succeeded':
      return tt('home.phaseState.succeeded');
    case 'failed':
      return tt('home.phaseState.failed');
    case 'skipped':
      return tt('home.phaseState.skipped');
    case 'cancelled':
      return tt('home.phaseState.cancelled');
    default:
      return state;
  }
}

export function phaseLabel(phase: SessionPhase | undefined, tt: TFn): string {
  if (!phase?.name) return '';
  switch (phase.name) {
    case 'target_definition':
      return tt('home.phase.target_definition');
    case 'discovery':
      return tt('home.phase.discovery');
    case 'configuration':
      return tt('home.phase.configuration');
    case 'preflight_validation':
      return tt('home.phase.preflight_validation');
    case 'review_approval':
      return tt('home.phase.review_approval');
    case 'host_preparation':
      return tt('home.phase.host_preparation');
    case 'artifact_certificate_prep':
      return tt('home.phase.artifact_certificate_prep');
    case 'storage_node_install':
      return tt('home.phase.storage_node_install');
    case 'storage_init':
      return tt('home.phase.storage_init');
    case 'database_creation':
      return tt('home.phase.database_creation');
    case 'compute_node_install':
      return tt('home.phase.compute_node_install');
    case 'post_install_verification':
      return tt('home.phase.post_install_verification');
    case 'completion_reporting':
      return tt('home.phase.completion_reporting');
    default:
      return phase.name.replace(/_/g, ' ');
  }
}

export function currentPhaseFromSession(session: InstallationSession | undefined): SessionPhase | undefined {
  if (!session?.phases?.length || session.currentPhaseId == null) return undefined;
  const id = session.currentPhaseId;
  return session.phases.find((p) => p.phaseId === id);
}

/** Short nav label for the primary "continue" action from a resolved path. */
export function workDestinationNavLabel(path: string, tt: TFn): string {
  const base = path.split('?')[0] ?? path;
  if (base === '/monitoring') return tt('nav.monitoring');
  if (base === '/results') return tt('nav.results');
  if (base === '/logs') return tt('nav.logs');
  if (base === '/configuration') return tt('nav.configuration');
  return tt('nav.wizard');
}

/** Whether the operator may reset persisted installation state (not during an active run). */
export function canResetInstallationConfiguration(status: string | undefined): boolean {
  if (!status) return false;
  return status !== 'running' && status !== 'cancel_requested';
}
