import { Card, Flex, Loader, Text } from '@gravity-ui/uikit';
import { Link as RouterLink } from 'react-router-dom';
import { t } from '@/i18n';
import { useInstallationSession } from '@/session/InstallationSessionProvider';

export function HomePage() {
  const { session, isLoading, error } = useInstallationSession();

  return (
    <Flex direction="column" gap={4}>
      <Text variant="header-1">{t('home.heading')}</Text>
      <Text color="secondary">{t('home.description')}</Text>

      {isLoading && <Loader size="l" />}
      {error && (
        <Text color="danger">
          {error.message} — start the Go server or use Vite proxy to /api.
        </Text>
      )}

      {!isLoading && !error && session && (
        <Card style={{ padding: 16 }}>
          <Flex direction="column" gap={3}>
            <div>
              <Text variant="subheader-2">{session.title ?? t('home.sessionTitle')}</Text>
              <Text color="secondary">{session.status}</Text>
            </div>
            <Flex gap={3}>
              <RouterLink to="/wizard">{t('nav.wizard')}</RouterLink>
              <Text color="secondary">·</Text>
              <RouterLink to="/monitor">{t('nav.monitor')}</RouterLink>
            </Flex>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}
