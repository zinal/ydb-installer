import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from '@gravity-ui/uikit';
import { useAuthSession } from '@/session/AuthSessionProvider';

export function LogoutPage() {
  const { logout } = useAuthSession();
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      await logout();
      navigate('/', { replace: true });
    })();
  }, [logout, navigate]);

  return <Loader size="l" />;
}
