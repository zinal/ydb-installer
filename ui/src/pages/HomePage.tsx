import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Flex, Loader, RadioGroup, Text, TextInput } from '@gravity-ui/uikit';
import { api } from '@/api/client';
import { t } from '@/i18n';
import { resolvePostLoginDestination } from '@/navigation/postLoginRouting';
import { useInstallationSession } from '@/session/InstallationSessionProvider';
import { useAuthPrototype, type PrototypeRole } from '@/session/AuthPrototypeProvider';

export function HomePage() {
  const { session, sessionId, isLoading, error } = useInstallationSession();
  const { role, login } = useAuthPrototype();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<PrototypeRole>('operator');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const onSignIn = async () => {
    if (!sessionId) return;
    setLoginBusy(true);
    try {
      login(selectedRole, password);
      const [sess, snap] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['session', sessionId],
          queryFn: () => api.getSession(sessionId),
        }),
        queryClient
          .fetchQuery({
            queryKey: ['discovery', sessionId],
            queryFn: () => api.getDiscovery(sessionId),
          })
          .catch(() => undefined),
      ]);
      const dest = resolvePostLoginDestination(sess, snap);
      navigate(dest, { replace: true });
    } finally {
      setLoginBusy(false);
    }
  };

  return (
    <Flex direction="column" gap={5}>
      <Text as="div" variant="header-1">
        {t('home.heading')}
      </Text>
      <Text as="div" variant="body-2" color="complementary">
        {t('home.description')}
      </Text>

      {isLoading && <Loader size="l" />}
      {error && (
        <Text as="div" color="danger">
          {error.message} — start the Go server or use Vite proxy to /api.
        </Text>
      )}

      {!isLoading && !error && session && (
        <>
          {!role ? (
            <Card style={{ padding: 24 }}>
              <Flex direction="column" gap={4}>
                <Text as="div" variant="subheader-2" color="primary">
                  {t('auth.signIn')}
                </Text>

                <Text as="div" variant="body-2" color="complementary">
                  {t('auth.signInHint')}
                </Text>

                <Flex direction="column" gap={4} style={{ maxWidth: 440 }}>
                  <RadioGroup
                    size="l"
                    name="role"
                    options={[
                      { value: 'operator', content: t('auth.roleOperator') },
                      { value: 'observer', content: t('auth.roleObserver') },
                    ]}
                    value={selectedRole}
                    onUpdate={(v) => setSelectedRole(v as PrototypeRole)}
                  />
                  <TextInput
                    label={t('auth.password')}
                    type="password"
                    value={password}
                    onUpdate={setPassword}
                    size="l"
                  />
                  <Button view="action" size="l" loading={loginBusy} onClick={() => void onSignIn()}>
                    {t('auth.submit')}
                  </Button>
                </Flex>
              </Flex>
            </Card>
          ) : (
            <Card style={{ padding: 24 }}>
              <Flex direction="column" gap={3}>
                <Text as="div" variant="body-2" color="complementary">
                  {t('auth.signedInAs')}{' '}
                  {role === 'operator' ? t('auth.roleOperator') : t('auth.roleObserver')}
                </Text>
                <Text as="div" variant="body-2" color="complementary">
                  {t('home.useHeaderNav')}
                </Text>
              </Flex>
            </Card>
          )}
        </>
      )}
    </Flex>
  );
}
