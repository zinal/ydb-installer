import { useState } from 'react';
import { Card, Flex, Switch, Text, TextInput, Select } from '@gravity-ui/uikit';
import { t } from '@/i18n';

/** Prototype logs view (§6.9); wire to session log API when available. */
export function LogsPage() {
  const [autoFollow, setAutoFollow] = useState(true);
  const [host, setHost] = useState<string[]>([]);

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
        <Text color="secondary">{t('logs.placeholder')}</Text>
      </Card>
    </Flex>
  );
}
