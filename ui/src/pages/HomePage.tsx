import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Flex, Loader, RadioGroup, Text, TextInput } from '@gravity-ui/uikit';
import { api } from '@/api/client';
import { t } from '@/i18n';
import { resolvePostLoginDestination } from '@/navigation/postLoginRouting';
import { useAuthSession } from '@/session/AuthSessionProvider';

export function HomePage() {
  const { role, login, identity } = useAuthSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<'operator' | 'observer'>('operator');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const onSignIn = async () => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      await login(selectedRole, password);
      let currentSession = ((await api.listSessions(1)) ?? [])[0];
      if (!currentSession) {
        currentSession = await api.createSession({ mode: 'interactive', title: t('home.sessionTitle') });
      }
      const [sessionForDestination, snap] = await Promise.all([
        Promise.resolve(currentSession),
        queryClient
          .fetchQuery({
            queryKey: ['discovery', currentSession.id],
            queryFn: () => api.getDiscovery(currentSession.id),
          })
          .catch(() => undefined),
      ]);
      await queryClient.invalidateQueries({ queryKey: ['installation-session'] });
      await queryClient.invalidateQueries({ queryKey: ['session', currentSession.id] });
      const dest = resolvePostLoginDestination(sessionForDestination, snap);
      const requested = searchParams.get('next');
      navigate(requested && requested.startsWith('/') ? requested : dest, { replace: true });
    } catch (e) {
      setLoginError((e as Error).message || t('auth.loginFailed'));
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

      {loginBusy && <Loader size="l" />}

      {!identity ? (
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
                onUpdate={(v) => setSelectedRole(v as 'operator' | 'observer')}
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
              {loginError && (
                <Text as="div" color="danger">
                  {loginError}
                </Text>
              )}
            </Flex>
          </Flex>
        </Card>
      ) : (
        <Card style={{ padding: 24 }}>
          <Flex direction="column" gap={3}>
            <Text as="div" variant="body-2" color="complementary">
              {t('auth.signedInAs')}{' '}
              {role === 'operator'
                ? t('auth.roleOperator')
                : role === 'observer'
                  ? t('auth.roleObserver')
                  : identity.username}
            </Text>
            <Text as="div" variant="body-2" color="complementary">
              {t('home.useHeaderNav')}
            </Text>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}
