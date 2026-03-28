import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button, Flex, Text } from '@gravity-ui/uikit';
import { t } from '@/i18n';
import { useAuthPrototype } from '@/session/AuthPrototypeProvider';
import { useInstallationSession } from '@/session/InstallationSessionProvider';

export function AppLayout() {
  const { role, logout } = useAuthPrototype();
  const { session, isLoading: sessionLoading } = useInstallationSession();
  const navigate = useNavigate();

  return (
    <Flex direction="column" style={{ minHeight: '100vh' }}>
      <Flex
        as="header"
        direction="column"
        style={{
          borderBottom: '1px solid var(--g-color-line-generic)',
        }}
      >
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          style={{ padding: '12px 24px' }}
        >
          <Text variant="header-1">{t('app.title')}</Text>
          {role ? (
            <Flex gap={3} alignItems="center" wrap="wrap" className="installer-nav">
              <RouterLink to="/">{t('nav.home')}</RouterLink>
              <RouterLink to="/configuration">{t('nav.configuration')}</RouterLink>
              <RouterLink to="/monitoring">{t('nav.monitoring')}</RouterLink>
              <RouterLink to="/logs">{t('nav.logs')}</RouterLink>
              <RouterLink to="/results">{t('nav.results')}</RouterLink>
              <RouterLink to="/batch">{t('nav.batch')}</RouterLink>
              <Text variant="body-2" color="complementary">
                {role === 'operator' ? t('auth.roleOperator') : t('auth.roleObserver')}
              </Text>
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
          ) : null}
        </Flex>
        {role && (
          <Flex style={{ padding: '8px 24px 14px' }}>
            <Text variant="body-2" color="complementary">
              {sessionLoading && !session
                ? t('layout.sessionLoading')
                : `${session?.title ?? t('home.sessionTitle')} · ${session?.status ?? '…'}`}
            </Text>
          </Flex>
        )}
      </Flex>
      <Flex direction="column" className="installer-main" style={{ padding: '28px 28px 32px', flex: 1 }}>
        <Outlet />
      </Flex>
    </Flex>
  );
}
