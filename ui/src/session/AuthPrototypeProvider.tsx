import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { clearWizardUiState } from '@/navigation/wizardStepStorage';

export type PrototypeRole = 'operator' | 'observer';

/** Persists prototype role across reloads (session tab scope). Password is never stored (FR-SECURITY-008). */
export const PROTOTYPE_ROLE_STORAGE_KEY = 'ydb-installer.prototype.role';

function readStoredRole(): PrototypeRole | null {
  try {
    const v = sessionStorage.getItem(PROTOTYPE_ROLE_STORAGE_KEY);
    if (v === 'operator' || v === 'observer') return v;
  } catch {
    /* ignore */
  }
  return null;
}

type AuthValue = {
  role: PrototypeRole | null;
  login: (r: PrototypeRole, _password: string) => void;
  logout: () => void;
};

const AuthPrototypeContext = createContext<AuthValue | null>(null);

/** Local role state for UI prototype (§3.2, FR-INTERACTIVE-015); replace with real auth when wired. */
export function AuthPrototypeProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PrototypeRole | null>(() => readStoredRole());

  const login = useCallback((r: PrototypeRole, _password: string) => {
    setRole(r);
    try {
      sessionStorage.setItem(PROTOTYPE_ROLE_STORAGE_KEY, r);
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    clearWizardUiState();
    try {
      sessionStorage.removeItem(PROTOTYPE_ROLE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setRole(null);
  }, []);

  const value = useMemo(() => ({ role, login, logout }), [role, login, logout]);

  return (
    <AuthPrototypeContext.Provider value={value}>{children}</AuthPrototypeContext.Provider>
  );
}

export function useAuthPrototype(): AuthValue {
  const ctx = useContext(AuthPrototypeContext);
  if (!ctx) {
    throw new Error('useAuthPrototype must be used within AuthPrototypeProvider');
  }
  return ctx;
}
