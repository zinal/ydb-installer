import { Button, Card, Flex, Loader, Text } from '@gravity-ui/uikit';
import { t } from '@/i18n';
import type { SessionPhase } from '@/api/client';

type Props = {
  targetsSaved: boolean;
  discoveryPhase: SessionPhase | undefined;
  runDiscoveryPending: boolean;
  refreshDiscoveryPending: boolean;
  onRunDiscovery: () => void;
  onRefreshDiscovery: () => void;
  runError: Error | null;
  readOnly: boolean;
};

export function DiscoveryRunStep({
  targetsSaved,
  discoveryPhase,
  runDiscoveryPending,
  refreshDiscoveryPending,
  onRunDiscovery,
  onRefreshDiscovery,
  runError,
  readOnly,
}: Props) {
  const running =
    discoveryPhase?.state === 'running' || runDiscoveryPending || refreshDiscoveryPending;

  return (
    <Card style={{ padding: 16 }}>
      <Text variant="subheader-2" style={{ marginBottom: 8 }}>
        {t('wizard.step.discovery_run')}
      </Text>
      <Text color="secondary" style={{ marginBottom: 12 }}>
        {t('wizard.discovery.hint')}
      </Text>
      {running ? (
        <Flex alignItems="center" gap={2}>
          <Loader size="s" />
          <Text>{t('wizard.discovery.running')}</Text>
        </Flex>
      ) : (
        <Flex gap={2}>
          <Button
            view="action"
            size="l"
            disabled={!targetsSaved || readOnly}
            loading={runDiscoveryPending}
            onClick={onRunDiscovery}
          >
            {t('wizard.discovery.run')}
          </Button>
          <Button
            view="outlined"
            size="l"
            disabled={!targetsSaved || readOnly}
            loading={refreshDiscoveryPending}
            onClick={onRefreshDiscovery}
          >
            {t('wizard.discovery.refresh')}
          </Button>
        </Flex>
      )}
      {runError && (
        <Text color="danger" style={{ marginTop: 12 }}>
          {runError.message}
        </Text>
      )}
    </Card>
  );
}
