import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Flex, Loader, Text } from '@gravity-ui/uikit';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { t } from '@/i18n';

export function HomePage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['sessions'], queryFn: () => api.listSessions() });
  const create = useMutation({
    mutationFn: () => api.createSession({ mode: 'interactive', title: 'Interactive install' }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      nav(`/sessions/${s.id}/wizard`);
    },
  });

  return (
    <Flex direction="column" gap={4}>
      <Flex justifyContent="space-between" alignItems="center">
        <Text variant="header-1">{t('home.heading')}</Text>
        <Button view="action" size="l" onClick={() => create.mutate()} loading={create.isPending}>
          {t('home.newInteractive')}
        </Button>
      </Flex>
      {q.isLoading && <Loader size="l" />}
      {q.error && (
        <Text color="danger">
          {(q.error as Error).message} — start the Go server or use Vite proxy to /api.
        </Text>
      )}
      <Flex direction="column" gap={2}>
        {q.data?.map((s) => (
          <Card key={s.id} style={{ padding: 16 }}>
            <Flex justifyContent="space-between" alignItems="center">
              <div>
                <Text variant="subheader-2">{s.title ?? s.id}</Text>
                <Text color="secondary">{s.status}</Text>
              </div>
              <RouterLink to={`/sessions/${s.id}/wizard`}>Wizard</RouterLink>
              {' · '}
              <RouterLink to={`/sessions/${s.id}/monitor`}>Monitor</RouterLink>
            </Flex>
          </Card>
        ))}
      </Flex>
    </Flex>
  );
}
