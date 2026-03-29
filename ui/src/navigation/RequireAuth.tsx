import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader } from '@gravity-ui/uikit';
import { useAuthSession } from '@/session/AuthSessionProvider';

export function RequireAuth({ children }: { children: ReactElement }) {
  const { identity, isLoading } = useAuthSession();
  const location = useLocation();
  if (isLoading) {
    return <Loader size="l" />;
  }
  if (!identity) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}
