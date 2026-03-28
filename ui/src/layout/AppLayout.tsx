import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button, Flex, Text } from '@gravity-ui/uikit';
import { t } from '@/i18n';
import { useAuthPrototype } from '@/session/AuthPrototypeProvider';

export function AppLayout() {
  const { role, logout } = useAuthPrototype();
  const navigate = useNavigate();

  return (
    <Flex direction="column" style={{ minHeight: '100vh' }}>
      <Flex
        as="header"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--g-color-line-generic)',
        }}
      >
        <Text variant="header-1">{t('app.title')}</Text>
        <Flex gap={3} alignItems="center" wrap="wrap">
          <RouterLink to="/">{t('nav.home')}</RouterLink>
          <RouterLink to="/configuration">{t('nav.configuration')}</RouterLink>
          <RouterLink to="/monitoring">{t('nav.monitoring')}</RouterLink>
          <RouterLink to="/logs">{t('nav.logs')}</RouterLink>
          <RouterLink to="/batch">{t('nav.batch')}</RouterLink>
          {role && (
            <Text color="secondary" style={{ fontSize: 13 }}>
              {role === 'operator' ? t('auth.roleOperator') : t('auth.roleObserver')}
            </Text>
          )}
          <Button
            view="flat"
            size="s"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            {t('nav.logout')}
          </Button>
        </Flex>
      </Flex>
      <Flex direction="column" style={{ padding: '24px', flex: 1 }}>
        <Outlet />
      </Flex>
    </Flex>
  );
}
