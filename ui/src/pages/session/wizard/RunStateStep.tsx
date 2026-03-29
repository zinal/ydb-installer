import { Button, Card, Flex, Loader, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { t } from '@/i18n';

type Props = {
  sessionId: string;
  readOnly: boolean;
};

export function RunStateStep({ sessionId, readOnly }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const progressQ = useQuery({
    queryKey: ['progress', sessionId],
    queryFn: () => api.getProgress(sessionId),
    refetchInterval: 4000,
  });
  const resumeM = useMutation({
    mutationFn: () => api.resumeExecution(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress', sessionId] });
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
  const cancelM = useMutation({
    mutationFn: () => api.cancelExecution(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress', sessionId] });
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
  const canResume = !readOnly && progressQ.data?.recentLogLines?.some((line) => line.includes('cancel'));

  return (
    <Flex direction="column" gap={4}>
      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 8 }}>
          {t('wizard.runState.summary')}
        </Text>
        {progressQ.isLoading ? (
          <Loader size="s" />
        ) : (
          <Flex direction="column" gap={2}>
            <Text color="secondary">{t('wizard.runState.summaryBody')}</Text>
            <Text color="secondary">
              Phase: {progressQ.data?.currentPhaseId ?? '—'} · Task: {progressQ.data?.currentTask ?? '—'}
            </Text>
            <Text color="secondary">Progress: {progressQ.data?.overallPercent ?? 0}%</Text>
          </Flex>
        )}
      </Card>

      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 8 }}>
          {t('wizard.runState.pending')}
        </Text>
        <Text color="secondary">{t('wizard.runState.none')}</Text>
        {!readOnly && (
          <Flex gap={2} style={{ marginTop: 12 }}>
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
      </Card>

      <Flex gap={2}>
        <Button view="action" onClick={() => navigate('/monitoring')}>
          {t('wizard.runState.openMonitoring')}
        </Button>
        <Button view="outlined" onClick={() => navigate('/logs')}>
          {t('wizard.runState.openLogs')}
        </Button>
      </Flex>
    </Flex>
  );
}
