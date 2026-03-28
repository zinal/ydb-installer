import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type PrototypeRole = 'operator' | 'observer';

type AuthValue = {
  role: PrototypeRole | null;
  login: (r: PrototypeRole, _password: string) => void;
  logout: () => void;
};

const AuthPrototypeContext = createContext<AuthValue | null>(null);

/** Local role state for UI prototype (§3.2, FR-INTERACTIVE-015); replace with real auth when wired. */
export function AuthPrototypeProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PrototypeRole | null>(null);

  const login = useCallback((r: PrototypeRole, _password: string) => {
    setRole(r);
  }, []);

  const logout = useCallback(() => {
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
