import { useState } from 'react';
import { Button, Card, Flex, Loader, RadioGroup, Text, TextInput } from '@gravity-ui/uikit';
import { Link as RouterLink } from 'react-router-dom';
import { t } from '@/i18n';
import { useInstallationSession } from '@/session/InstallationSessionProvider';
import { useAuthPrototype, type PrototypeRole } from '@/session/AuthPrototypeProvider';

export function HomePage() {
  const { session, isLoading, error } = useInstallationSession();
  const { role, login } = useAuthPrototype();
  const [selectedRole, setSelectedRole] = useState<PrototypeRole>('operator');
  const [password, setPassword] = useState('');

  return (
    <Flex direction="column" gap={4}>
      <Text variant="header-1">{t('home.heading')}</Text>
      <Text color="secondary">{t('home.description')}</Text>

      {isLoading && <Loader size="l" />}
      {error && (
        <Text color="danger">
          {error.message} — start the Go server or use Vite proxy to /api.
        </Text>
      )}

      {!isLoading && !error && session && (
        <>
          <Card style={{ padding: 16 }}>
            <Text variant="subheader-2" style={{ marginBottom: 12 }}>
              {t('auth.signIn')}
            </Text>
            <Text color="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
              {t('auth.signInHint')}
            </Text>
            <Flex direction="column" gap={3} style={{ maxWidth: 400 }}>
              <RadioGroup
                name="role"
                options={[
                  { value: 'operator', content: t('auth.roleOperator') },
                  { value: 'observer', content: t('auth.roleObserver') },
                ]}
                value={selectedRole}
                onUpdate={(v) => setSelectedRole(v as PrototypeRole)}
              />
              <TextInput
                label={t('auth.username')}
                placeholder={t('auth.usernameOptional')}
                disabled
              />
              <TextInput
                label={t('auth.password')}
                type="password"
                value={password}
                onUpdate={setPassword}
              />
              <Button
                view="action"
                onClick={() => login(selectedRole, password)}
              >
                {t('auth.submit')}
              </Button>
            </Flex>
            {role && (
              <Text color="secondary" style={{ marginTop: 12 }}>
                {t('auth.signedInAs')}{' '}
                {role === 'operator' ? t('auth.roleOperator') : t('auth.roleObserver')}
              </Text>
            )}
          </Card>

          <Card style={{ padding: 16 }}>
            <Flex direction="column" gap={3}>
              <div>
                <Text variant="subheader-2">{session.title ?? t('home.sessionTitle')}</Text>
                <Text color="secondary">{session.status}</Text>
              </div>
              <Flex gap={3} wrap="wrap">
                <RouterLink to="/configuration">{t('nav.configuration')}</RouterLink>
                <Text color="secondary">·</Text>
                <RouterLink to="/monitoring">{t('nav.monitoring')}</RouterLink>
                <Text color="secondary">·</Text>
                <RouterLink to="/logs">{t('nav.logs')}</RouterLink>
              </Flex>
            </Flex>
          </Card>
        </>
      )}
    </Flex>
  );
}
