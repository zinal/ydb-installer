import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AuthIdentity, type UserRole } from '@/api/client';
import { clearWizardUiState } from '@/navigation/wizardStepStorage';

type AuthValue = {
  identity: AuthIdentity | null;
  isLoading: boolean;
  role: UserRole | null;
  isOperator: boolean;
  isObserver: boolean;
  login: (role: UserRole, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthValue | null>(null);

function deriveRole(identity: AuthIdentity | null): UserRole | null {
  if (!identity?.roles?.length) return null;
  if (identity.roles.includes('operator')) return 'operator';
  if (identity.roles.includes('observer')) return 'observer';
  return identity.roles[0] ?? null;
}

/** API-backed auth state (FR-SECURITY-005, FR-ACCESS-001..005). */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const meQ = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.me(),
    retry: false,
    refetchOnWindowFocus: true,
  });

  const loginM = useMutation({
    mutationFn: (input: { role: UserRole; password: string }) => api.login(input),
    onSuccess: (identity) => {
      qc.setQueryData<AuthIdentity>(['auth', 'me'], identity);
    },
  });

  const logoutM = useMutation({
    mutationFn: () => api.logout(),
    onSettled: async () => {
      clearWizardUiState();
      qc.setQueryData(['auth', 'me'], null);
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const login = useCallback(
    async (role: UserRole, password: string) => {
      await loginM.mutateAsync({ role, password });
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    [loginM, qc],
  );

  const logout = useCallback(async () => {
    try {
      await logoutM.mutateAsync();
    } catch {
      clearWizardUiState();
      qc.setQueryData(['auth', 'me'], null);
    }
  }, [logoutM, qc]);

  const identity = meQ.data ?? null;
  const role = deriveRole(identity);
  const value = useMemo<AuthValue>(
    () => ({
      identity,
      isLoading: meQ.isLoading || loginM.isPending || logoutM.isPending,
      role,
      isOperator: role === 'operator',
      isObserver: role === 'observer',
      login,
      logout,
    }),
    [identity, meQ.isLoading, loginM.isPending, logoutM.isPending, role, login, logout],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }
  return ctx;
}
