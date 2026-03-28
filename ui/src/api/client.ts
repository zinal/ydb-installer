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
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export type InstallationMode = 'interactive' | 'batch';

export interface InstallationSession {
  id: string;
  mode: InstallationMode;
  status: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
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
