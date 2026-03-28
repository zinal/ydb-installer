import { useQuery } from '@tanstack/react-query';
import { Card, Flex, Loader, Text } from '@gravity-ui/uikit';
import { api } from '@/api/client';
import { t } from '@/i18n';
import { useInstallationSession } from '@/session/InstallationSessionProvider';

export function MonitorPage() {
  const { sessionId, isLoading: bootLoading, error: bootError } = useInstallationSession();
  const q = useQuery({
    queryKey: ['progress', sessionId],
    queryFn: () => api.getProgress(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: 5000,
  });

  if (!sessionId) {
    return (
      <Flex direction="column" gap={4}>
        <Text variant="header-1">{t('monitor.title')}</Text>
        {bootLoading && <Loader size="l" />}
        {bootError && <Text color="danger">{bootError.message}</Text>}
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap={4}>
      <Text variant="header-1">{t('monitor.title')}</Text>
      {q.isLoading && <Loader size="l" />}
      {q.error && <Text color="danger">{(q.error as Error).message}</Text>}
      <Card style={{ padding: 16 }}>
        <Text variant="code-1">{JSON.stringify(q.data ?? {}, null, 2)}</Text>
      </Card>
      <Text color="secondary">
        Placeholder: SSE or short-interval polling for phase, task, host state (FR-MONITORING-001).
      </Text>
    </Flex>
  );
}
