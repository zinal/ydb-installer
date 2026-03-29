import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Flex, Loader, Select, Switch, Text, TextInput } from '@gravity-ui/uikit';
import { api } from '@/api/client';
import { t } from '@/i18n';
import { useInstallationSession } from '@/session/InstallationSessionProvider';

/** Prototype logs view (§6.9); wire to session log API when available. */
export function LogsPage() {
  const { sessionId } = useInstallationSession();
  const [autoFollow, setAutoFollow] = useState(true);
  const [host, setHost] = useState<string[]>([]);
  const logsQ = useQuery({
    queryKey: ['logs', sessionId],
    queryFn: () => api.getLogs(sessionId!, 300),
    enabled: Boolean(sessionId),
    refetchInterval: autoFollow ? 4000 : false,
  });

  return (
    <Flex direction="column" gap={4}>
      <Text variant="header-1">{t('logs.title')}</Text>
      <Text color="secondary">{t('logs.description')}</Text>

      <Card style={{ padding: 16 }}>
        <Flex gap={4} wrap="wrap" alignItems="flex-end">
          <Select
            label={t('logs.filter.host')}
            options={[{ value: 'all', content: t('logs.filter.allHosts') }]}
            value={host.length ? host : ['all']}
            onUpdate={setHost}
            width={280}
          />
          <TextInput label={t('logs.filter.severity')} placeholder="info, warn, error" />
          <Flex gap={2} alignItems="center">
            <Text>{t('logs.autoFollow')}</Text>
            <Switch checked={autoFollow} onUpdate={setAutoFollow} />
          </Flex>
        </Flex>
      </Card>

      <Card style={{ padding: 16, minHeight: 200, fontFamily: 'var(--g-font-family-monospace)' }}>
        {logsQ.isLoading ? (
          <Loader size="s" />
        ) : (
          <Flex direction="column" gap={1}>
            {(logsQ.data?.lines ?? []).map((line, idx) => (
              <Text key={`${idx}-${line}`} variant="code-1">
                {line}
              </Text>
            ))}
          </Flex>
        )}
        {logsQ.error && <Text color="danger">{(logsQ.error as Error).message}</Text>}
      </Card>
    </Flex>
  );
}
