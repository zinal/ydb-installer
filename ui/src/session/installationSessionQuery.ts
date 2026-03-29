import type { UseQueryOptions } from '@tanstack/react-query';
import { api, type AuthIdentity, type InstallationSession } from '@/api/client';

export const INSTALLATION_SESSION_QUERY_KEY = ['installation-session'] as const;

const POLL_MS = 5000;

export function installationSessionQueryOptions(
  identity: AuthIdentity | null,
): UseQueryOptions<
  InstallationSession,
  Error,
  InstallationSession,
  typeof INSTALLATION_SESSION_QUERY_KEY
> {
  return {
    queryKey: INSTALLATION_SESSION_QUERY_KEY,
    queryFn: async (): Promise<InstallationSession> => {
      const list = (await api.listSessions(1)) ?? [];
      if (list.length > 0) {
        return list[0];
      }
      return api.createSession({ mode: identity?.mode ?? 'interactive', title: 'Interactive install' });
    },
    enabled: identity != null,
    refetchInterval: identity != null ? POLL_MS : false,
  };
}
