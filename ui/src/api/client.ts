const base = '';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: 'include',
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
export type UserRole = 'operator' | 'observer';

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
  /** Operator-entered target address from session (aligned with discovery order). */
  targetAddress?: string;
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

export interface AuthIdentity {
  username: string;
  roles: UserRole[];
  mode: InstallationMode;
}

export interface RuntimeMetadata {
  mode: InstallationMode;
}

export interface ValidationIssue {
  code: string;
  severity: 'blocking' | 'warning' | 'info';
  message: string;
  hostId?: string;
  phaseHint?: string;
}

export interface ValidationReport {
  sessionId: string;
  issues: ValidationIssue[];
  valid: boolean;
}

export interface ProgressSnapshot {
  sessionId: string;
  currentPhaseId: number;
  currentTask?: string;
  elapsedSeconds?: number;
  recentLogLines?: string[];
  overallPercent?: number;
}

export interface CompletionReport {
  sessionId: string;
  clusterEndpoints?: string[];
  layoutSummary?: string;
  securityMode?: string;
  databaseNames?: string[];
  verificationSummary?: string;
  nextSteps?: string;
  bridgeSummary?: string;
}

export interface SessionLogs {
  lines: string[];
}

export const api = {
  login: (body: { role: UserRole; password: string }) =>
    apiFetch<AuthIdentity>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () =>
    apiFetch<void>('/api/v1/auth/logout', {
      method: 'POST',
    }),

  me: () => apiFetch<AuthIdentity>('/api/v1/auth/me'),

  listSessions: async (limit = 50, offset = 0) =>
    (await apiFetch<InstallationSession[] | null>(`/api/v1/sessions?limit=${limit}&offset=${offset}`)) ?? [],

  createSession: (body: { mode: InstallationMode; title?: string }) =>
    apiFetch<InstallationSession>('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** Clears persisted installation state on the server (empty SQLite / store). Operator, interactive mode only. */
  resetInstallationState: () =>
    apiFetch<void>('/api/v1/sessions/reset-state', {
      method: 'POST',
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

  getTopologies: () => apiFetch<string[]>('/api/v1/metadata/topologies'),

  getArtifactModes: () => apiFetch<string[]>('/api/v1/metadata/artifact-modes'),

  getReference: () => apiFetch<Record<string, string>>('/api/v1/metadata/reference'),

  getRuntime: () => apiFetch<RuntimeMetadata>('/api/v1/metadata/runtime'),

  runDiscovery: (sessionId: string) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}/discovery/run`, { method: 'POST' }),

  runValidation: (sessionId: string) =>
    apiFetch<ValidationReport>(`/api/v1/sessions/${sessionId}/validation/run`, { method: 'POST' }),

  getValidation: (sessionId: string) =>
    apiFetch<ValidationReport>(`/api/v1/sessions/${sessionId}/validation`),

  approveExecution: (sessionId: string) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}/execution/approve`, { method: 'POST' }),

  startExecution: (sessionId: string) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}/execution/start`, { method: 'POST' }),

  getProgress: (sessionId: string) =>
    apiFetch<ProgressSnapshot>(`/api/v1/sessions/${sessionId}/execution/progress`),

  cancelExecution: (sessionId: string) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}/execution/cancel`, { method: 'POST' }),

  resumeExecution: (sessionId: string) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}/execution/resume`, { method: 'POST' }),

  getLogs: (sessionId: string, tail = 200) =>
    apiFetch<SessionLogs>(`/api/v1/sessions/${sessionId}/logs?tail=${tail}`),

  getCompletionReport: (sessionId: string) =>
    apiFetch<CompletionReport>(`/api/v1/sessions/${sessionId}/report/completion`),
};
