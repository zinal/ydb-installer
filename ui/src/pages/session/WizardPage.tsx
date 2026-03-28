import { useParams } from 'react-router-dom';
import { Card, Flex, Text } from '@gravity-ui/uikit';
import { TreeView } from 'ydb-ui-components';
import { wizardSteps } from './wizardSteps';
import { t } from '@/i18n';

export function WizardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  return (
    <Flex direction="column" gap={4}>
      <Text variant="header-1">{t('wizard.title')}</Text>
      <Text color="secondary">Session: {sessionId}</Text>
      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 12 }}>
          Steps (ydb-ui-components TreeView placeholder)
        </Text>
        <Flex direction="column" gap={1}>
          {wizardSteps.map((step, i) => (
            <TreeView
              key={step.id}
              name={t(step.labelKey)}
              title={step.id}
              level={0}
              collapsed={i > 0}
              active={i === 0}
            />
          ))}
        </Flex>
        <Text color="secondary" style={{ marginTop: 16 }}>
          Replace TreeView with full forms (react-hook-form) per step; connect to REST endpoints under
          /api/v1/sessions/:id/…
        </Text>
      </Card>
    </Flex>
  );
}
