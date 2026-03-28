import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type InstallationSession } from '@/api/client';

type InstallationSessionValue = {
  sessionId: string | undefined;
  session: InstallationSession | undefined;
  isLoading: boolean;
  error: Error | null;
};

const InstallationSessionContext = createContext<InstallationSessionValue | null>(null);

/**
 * Ensures exactly one interactive installation session for this control host:
 * reuses the most recently updated session if any exist, otherwise creates one.
 */
export function InstallationSessionProvider({ children }: { children: ReactNode }) {
  const q = useQuery({
    queryKey: ['installation-session'],
    queryFn: async () => {
      const list = await api.listSessions(1);
      if (list.length > 0) {
        return list[0];
      }
      return api.createSession({ mode: 'interactive', title: 'Interactive install' });
    },
  });

  const value: InstallationSessionValue = {
    sessionId: q.data?.id,
    session: q.data,
    isLoading: q.isLoading,
    error: (q.error as Error) ?? null,
  };

  return (
    <InstallationSessionContext.Provider value={value}>{children}</InstallationSessionContext.Provider>
  );
}

export function useInstallationSession(): InstallationSessionValue {
  const ctx = useContext(InstallationSessionContext);
  if (!ctx) {
    throw new Error('useInstallationSession must be used within InstallationSessionProvider');
  }
  return ctx;
}
