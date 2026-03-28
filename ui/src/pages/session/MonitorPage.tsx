import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Card, Flex, Loader, Text } from '@gravity-ui/uikit';
import { api } from '@/api/client';
import { t } from '@/i18n';

export function MonitorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const q = useQuery({
    queryKey: ['progress', sessionId],
    queryFn: () => api.getProgress(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: 5000,
  });

  return (
    <Flex direction="column" gap={4}>
      <Text variant="header-1">{t('monitor.title')}</Text>
      <Text color="secondary">Session: {sessionId}</Text>
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
