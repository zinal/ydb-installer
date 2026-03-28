import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from '@gravity-ui/uikit';
import { useAuthPrototype } from '@/session/AuthPrototypeProvider';

export function LogoutPage() {
  const { logout } = useAuthPrototype();
  const navigate = useNavigate();

  useEffect(() => {
    logout();
    navigate('/', { replace: true });
  }, [logout, navigate]);

  return <Loader size="l" />;
}
