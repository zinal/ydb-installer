import { Outlet, Link as RouterLink } from 'react-router-dom';
import { Flex, Text } from '@gravity-ui/uikit';
import { t } from '@/i18n';

export function AppLayout() {
  return (
    <Flex direction="column" style={{ minHeight: '100vh' }}>
      <Flex
        as="header"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--g-color-line-generic)',
        }}
      >
        <Text variant="header-1">{t('app.title')}</Text>
        <Flex gap={3}>
          <RouterLink to="/">{t('nav.home')}</RouterLink>
          <RouterLink to="/wizard">{t('nav.wizard')}</RouterLink>
          <RouterLink to="/monitor">{t('nav.monitor')}</RouterLink>
          <RouterLink to="/batch">{t('nav.batch')}</RouterLink>
        </Flex>
      </Flex>
      <Flex direction="column" style={{ padding: '24px', flex: 1 }}>
        <Outlet />
      </Flex>
    </Flex>
  );
}
