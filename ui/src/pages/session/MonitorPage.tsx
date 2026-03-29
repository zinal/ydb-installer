import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Flex, Loader, Text } from '@gravity-ui/uikit';
import { api } from '@/api/client';
import { t } from '@/i18n';
import { useInstallationSession } from '@/session/InstallationSessionProvider';
import { useAuthSession } from '@/session/AuthSessionProvider';

export function MonitorPage() {
  const { sessionId, isLoading: bootLoading, error: bootError } = useInstallationSession();
  const { isOperator } = useAuthSession();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['progress', sessionId],
    queryFn: () => api.getProgress(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: 5000,
  });
  const cancelM = useMutation({
    mutationFn: () => api.cancelExecution(sessionId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress', sessionId] });
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
  const resumeM = useMutation({
    mutationFn: () => api.resumeExecution(sessionId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress', sessionId] });
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
  const canResume = isOperator && q.data?.recentLogLines?.some((line) => line.includes('cancel'));

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
        <Flex direction="column" gap={2}>
          <Text>Phase: {q.data?.currentPhaseId ?? '—'}</Text>
          <Text>Task: {q.data?.currentTask ?? '—'}</Text>
          <Text>Progress: {q.data?.overallPercent ?? 0}%</Text>
          <Text>Elapsed: {q.data?.elapsedSeconds ?? 0}s</Text>
        </Flex>
      </Card>
      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 8 }}>
          {t('monitor.recentLogs')}
        </Text>
        <Flex direction="column" gap={1}>
          {(q.data?.recentLogLines ?? []).slice(-15).map((line, idx) => (
            <Text key={`${idx}-${line}`} variant="code-1">
              {line}
            </Text>
          ))}
        </Flex>
      </Card>
      {isOperator && (
        <Flex gap={2}>
          <Button view="outlined-danger" loading={cancelM.isPending} onClick={() => cancelM.mutate()}>
            {t('monitor.cancel')}
          </Button>
          {canResume && (
            <Button view="outlined" loading={resumeM.isPending} onClick={() => resumeM.mutate()}>
              {t('monitor.resume')}
            </Button>
          )}
        </Flex>
      )}
      <Text color="secondary">
        Placeholder: SSE or short-interval polling for phase, task, host state (FR-MONITORING-001).
      </Text>
    </Flex>
  );
}
