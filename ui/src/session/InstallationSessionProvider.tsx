import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InstallationSession } from '@/api/client';
import { useAuthSession } from './AuthSessionProvider';
import { installationSessionQueryOptions } from './installationSessionQuery';

type InstallationSessionValue = {
  sessionId: string | undefined;
  session: InstallationSession | undefined;
  isLoading: boolean;
  error: Error | null;
};

const InstallationSessionContext = createContext<InstallationSessionValue | null>(null);

/**
 * Ensures exactly one installation session for this control host:
 * reuses the most recently updated session if any exist, otherwise creates one.
 */
export function InstallationSessionProvider({ children }: { children: ReactNode }) {
  const { identity } = useAuthSession();
  const q = useQuery(installationSessionQueryOptions(identity));

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
