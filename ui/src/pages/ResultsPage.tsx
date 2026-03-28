import { Card, Flex, Text } from '@gravity-ui/uikit';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { t } from '@/i18n';
import { useInstallationSession } from '@/session/InstallationSessionProvider';

/** Session outcome view after installation completes or fails (prototype; extend with FR-REPORTING when wired). */
export function ResultsPage() {
  const { sessionId, isLoading, error } = useInstallationSession();

  const progressQ = useQuery({
    queryKey: ['progress', sessionId],
    queryFn: () => api.getProgress(sessionId!),
    enabled: Boolean(sessionId),
  });

  return (
    <Flex direction="column" gap={4}>
      <Text variant="header-1">{t('results.title')}</Text>
      <Text color="secondary">{t('results.description')}</Text>

      {isLoading && <Text color="secondary">{t('results.loading')}</Text>}
      {error && <Text color="danger">{error.message}</Text>}

      <Card style={{ padding: 16 }}>
        <Text variant="code-1" style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
          {JSON.stringify(progressQ.data ?? {}, null, 2)}
        </Text>
      </Card>
    </Flex>
  );
}
