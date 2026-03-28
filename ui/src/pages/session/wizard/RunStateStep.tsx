import { Button, Card, Flex, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n';

type Props = {
  readOnly: boolean;
  onConfirmPending?: () => void;
};

export function RunStateStep({ readOnly, onConfirmPending }: Props) {
  const navigate = useNavigate();

  return (
    <Flex direction="column" gap={4}>
      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 8 }}>
          {t('wizard.runState.summary')}
        </Text>
        <Text color="secondary">{t('wizard.runState.summaryBody')}</Text>
      </Card>

      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 8 }}>
          {t('wizard.runState.pending')}
        </Text>
        <Text color="secondary">{t('wizard.runState.none')}</Text>
        {!readOnly && (
          <Button style={{ marginTop: 12 }} view="outlined" onClick={onConfirmPending}>
            {t('wizard.runState.mockConfirm')}
          </Button>
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
