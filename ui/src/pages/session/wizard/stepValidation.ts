import type { ConfigurationDraft } from './configurationDraft';
import type { DiscoverySnapshot, InstallationSession } from '@/api/client';

/** True when the session has persisted targets or the wizard form has at least one non-empty address. */
export function hasCommittedOrDraftTargets(
  session: InstallationSession | undefined,
  formTargets: { address?: string }[] | undefined,
): boolean {
  if ((session?.targets?.length ?? 0) > 0) return true;
  return (formTargets ?? []).some((r) => (r.address ?? '').trim().length > 0);
}

export function validateLayoutStep(d: ConfigurationDraft): string | null {
  if (!d.layout.preset.trim()) return 'layout.presetRequired';
  if (!d.layout.topology.trim()) return 'layout.topologyRequired';
  if (d.layout.bridgeMode) {
    if (!d.layout.piles.length) return 'layout.pileRequired';
    for (const p of d.layout.piles) {
      if (!p.id.trim() || !p.failureDomain.trim()) return 'layout.pileFields';
    }
  }
  return null;
}

export function validateStorageStep(
  d: ConfigurationDraft,
  hostIds: string[],
): string | null {
  if (d.storage.expertOverride) {
    for (const hid of hostIds) {
      if (!d.storage.expertDeviceByHost[hid]?.trim()) {
        return 'storage.expertDeviceRequired';
      }
    }
    return null;
  }
  for (const hid of hostIds) {
    if ((d.storageByHost[hid]?.length ?? 0) === 0) {
      return 'storage.diskRequired';
    }
  }
  return null;
}

export function validateNetworkStep(d: ConfigurationDraft): string | null {
  if (!d.network.frontFqdn.trim()) return 'network.frontRequired';
  if (d.network.model === 'separated' && !d.network.backFqdn.trim()) {
    return 'network.backRequired';
  }
  return null;
}

export function validateSecurityStep(d: ConfigurationDraft): string | null {
  if (!d.security.tlsMode.trim()) return 'security.tlsRequired';
  if (d.security.tlsMode === 'operator-provided') {
    if (!d.security.certPath.trim() || !d.security.keyPath.trim()) {
      return 'security.pathsRequired';
    }
  }
  return null;
}

export function validateArtifactsStep(d: ConfigurationDraft): string | null {
  if (!d.artifacts.sourceMode) return 'artifacts.modeRequired';
  if (!d.artifacts.version.trim()) return 'artifacts.versionRequired';
  if (d.artifacts.sourceMode === 'local-archive' || d.artifacts.sourceMode === 'local-binaries') {
    if (!d.artifacts.localPath.trim()) return 'artifacts.pathRequired';
  }
  if (d.artifacts.sourceMode === 'mirror' && !d.artifacts.mirrorUrl.trim()) {
    return 'artifacts.mirrorRequired';
  }
  return null;
}

export function validateDatabaseStep(d: ConfigurationDraft): string | null {
  if (!d.database.name.trim()) return 'database.nameRequired';
  return null;
}

export function validateThroughDatabase(
  draft: ConfigurationDraft,
  hostIds: string[],
): string | null {
  return (
    validateLayoutStep(draft) ??
    validateStorageStep(draft, hostIds) ??
    validateNetworkStep(draft) ??
    validateSecurityStep(draft) ??
    validateArtifactsStep(draft) ??
    validateDatabaseStep(draft)
  );
}

/**
 * Whether the operator may navigate to `targetIndex` (0–9). See §6.5.
 */
export function canReachStep(
  targetIndex: number,
  session: InstallationSession | undefined,
  snapshot: DiscoverySnapshot | undefined,
  draft: ConfigurationDraft,
  formTargets?: { address?: string }[],
): boolean {
  const targetsSaved = hasCommittedOrDraftTargets(session, formTargets);
  const hasSnapshot = Boolean(snapshot?.collectedAt);
  const hostIds = snapshot?.hosts?.map((h) => h.hostId) ?? [];

  if (targetIndex <= 0) return true;
  if (!targetsSaved) return false;
  if (targetIndex <= 1) return true;
  if (!hasSnapshot) return false;
  if (!draft.discoveryAcknowledged) return false;

  if (targetIndex >= 3 && validateLayoutStep(draft)) return false;
  if (targetIndex >= 4 && validateStorageStep(draft, hostIds)) return false;
  if (targetIndex >= 5 && validateNetworkStep(draft)) return false;
  if (targetIndex >= 6 && validateSecurityStep(draft)) return false;
  if (targetIndex >= 7 && validateArtifactsStep(draft)) return false;
  if (targetIndex >= 8 && validateDatabaseStep(draft)) return false;
  if (targetIndex >= 9 && !draft.executionStarted) return false;
  return true;
}
