import { Card, Flex, Text } from '@gravity-ui/uikit';
import { t } from '@/i18n';

export function BatchPage() {
  return (
    <Flex direction="column" gap={4}>
      <Text variant="header-1">{t('batch.title')}</Text>
      <Card style={{ padding: 24 }}>
        <Text>{t('batch.upload')}</Text>
        <Text color="secondary" style={{ marginTop: 8 }}>
          Placeholder: file input and POST to /api/v1/sessions (batch) will be wired to the backend.
        </Text>
      </Card>
    </Flex>
  );
}
