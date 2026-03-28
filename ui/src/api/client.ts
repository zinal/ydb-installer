const base = '';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204 || res.status === 202) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export type InstallationMode = 'interactive' | 'batch';

export type PhaseState = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';

export interface SessionPhase {
  phaseId: number;
  name: string;
  state: PhaseState;
  startedAt?: string;
  endedAt?: string;
  message?: string;
}

export interface TargetHost {
  address: string;
  port?: number;
  user?: string;
  hostId?: string;
  bastionHost?: string;
  bastionUser?: string;
}

export interface NetworkInterface {
  name: string;
  addresses?: string[];
}

export interface DiscoveredDisk {
  deviceId: string;
  sizeBytes?: number;
  mediaKind?: string;
  systemDisk?: boolean;
  mounted?: boolean;
  empty?: boolean;
  hasYdbLabels?: boolean;
  detail?: string;
}

export interface DiscoveredHost {
  hostId: string;
  hostname: string;
  fqdn?: string;
  osName?: string;
  osVersion?: string;
  cpus?: number;
  memoryBytes?: number;
  interfaces?: NetworkInterface[];
  disks?: DiscoveredDisk[];
  timeSyncHint?: string;
  discoveryError?: string;
}

export interface DiscoverySnapshot {
  sessionId: string;
  hosts: DiscoveredHost[];
  collectedAt?: string;
}

export interface InstallationSession {
  id: string;
  mode: InstallationMode;
  status: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  phases?: SessionPhase[];
  currentPhaseId?: number;
  targets?: TargetHost[];
}

export const api = {
  listSessions: (limit = 50, offset = 0) =>
    apiFetch<InstallationSession[]>(`/api/v1/sessions?limit=${limit}&offset=${offset}`),

  createSession: (body: { mode: InstallationMode; title?: string }) =>
    apiFetch<InstallationSession>('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getSession: (sessionId: string) =>
    apiFetch<InstallationSession>(`/api/v1/sessions/${sessionId}`),

  patchSession: (sessionId: string, body: { title?: string }) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  setTargets: (sessionId: string, targets: TargetHost[]) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}/targets`, {
      method: 'POST',
      body: JSON.stringify({ targets }),
    }),

  getDiscovery: (sessionId: string) =>
    apiFetch<DiscoverySnapshot>(`/api/v1/sessions/${sessionId}/discovery`),

  refreshDiscovery: (sessionId: string) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}/discovery/refresh`, { method: 'POST' }),

  getTopologies: () => apiFetch<string[]>('/api/v1/metadata/topologies'),

  getArtifactModes: () => apiFetch<string[]>('/api/v1/metadata/artifact-modes'),

  getReference: () => apiFetch<Record<string, string>>('/api/v1/metadata/reference'),

  runDiscovery: (sessionId: string) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}/discovery/run`, { method: 'POST' }),

  runValidation: (sessionId: string) =>
    apiFetch<unknown>(`/api/v1/sessions/${sessionId}/validation/run`, { method: 'POST' }),

  getProgress: (sessionId: string) =>
    apiFetch<unknown>(`/api/v1/sessions/${sessionId}/execution/progress`),

  cancelExecution: (sessionId: string) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}/execution/cancel`, { method: 'POST' }),
};
