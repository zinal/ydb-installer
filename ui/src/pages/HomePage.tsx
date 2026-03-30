import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, Flex, Loader, RadioGroup, Text, TextInput } from '@gravity-ui/uikit';
import { api } from '@/api/client';
import { t } from '@/i18n';
import { resolvePostLoginDestination } from '@/navigation/postLoginRouting';
import { clearWizardUiState } from '@/navigation/wizardStepStorage';
import {
  canResetInstallationConfiguration,
  currentPhaseFromSession,
  phaseLabel,
  phaseStateLabel,
  sessionStatusLabel,
  workDestinationNavLabel,
} from '@/pages/homeInstallationStatus';
import { useAuthSession } from '@/session/AuthSessionProvider';
import {
  INSTALLATION_SESSION_QUERY_KEY,
  installationSessionQueryOptions,
} from '@/session/installationSessionQuery';

const DISCOVERY_POLL_MS = 5000;

export function HomePage() {
  const { role, login, identity, isOperator } = useAuthSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<'operator' | 'observer'>('operator');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetBanner, setResetBanner] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

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
      await queryClient.invalidateQueries({ queryKey: INSTALLATION_SESSION_QUERY_KEY });
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

  const sessionQuery = useQuery(installationSessionQueryOptions(identity));
  const session = sessionQuery.data;
  const sessionId = session?.id;

  const resetMutation = useMutation({
    mutationFn: () => api.resetInstallationState(),
    onSuccess: async () => {
      clearWizardUiState();
      await queryClient.invalidateQueries();
      setResetDialogOpen(false);
      setResetBanner({ tone: 'success', text: t('home.resetConfigurationSuccess') });
    },
    onError: (e: Error) => {
      setResetBanner({ tone: 'danger', text: e.message || String(e) });
    },
  });

  const discoveryQuery = useQuery({
    queryKey: ['discovery', sessionId],
    queryFn: () => api.getDiscovery(sessionId!),
    enabled: Boolean(identity && sessionId),
    refetchInterval: identity && sessionId ? DISCOVERY_POLL_MS : false,
  });

  const workPath = useMemo(() => {
    if (!session) return '/configuration';
    return resolvePostLoginDestination(session, discoveryQuery.data);
  }, [session, discoveryQuery.data]);

  const currentPhase = currentPhaseFromSession(session);
  const primaryNavLabel = workDestinationNavLabel(workPath, t);
  const resetAllowed =
    identity != null &&
    isOperator &&
    identity.mode === 'interactive' &&
    session != null &&
    canResetInstallationConfiguration(session.status);

  return (
    <Flex direction="column" gap={5}>
      <Text as="div" variant="header-1">
        {identity ? t('home.signedInHeading') : t('home.heading')}
      </Text>
      <Text as="div" variant="body-2" color="complementary">
        {identity ? t('home.signedInDescription') : t('home.description')}
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
          <Flex direction="column" gap={4}>
            <Text as="div" variant="body-2" color="complementary">
              {t('auth.signedInAs')}{' '}
              {role === 'operator'
                ? t('auth.roleOperator')
                : role === 'observer'
                  ? t('auth.roleObserver')
                  : identity.username}
            </Text>

            {sessionQuery.isLoading && !session ? (
              <Loader size="m" />
            ) : sessionQuery.error ? (
              <Text as="div" color="danger">
                {(sessionQuery.error as Error).message}
              </Text>
            ) : session ? (
              <>
                <Text as="div" variant="subheader-2">
                  {t('home.installationState')}
                </Text>
                <Flex direction="column" gap={2}>
                  <Text as="div" variant="body-2">
                    <Text as="span" color="secondary">
                      {t('home.sessionTitleLabel')}{' '}
                    </Text>
                    {session.title?.trim() || t('home.sessionTitle')}
                  </Text>
                  <Text as="div" variant="body-2">
                    <Text as="span" color="secondary">
                      {t('home.statusLabel')}{' '}
                    </Text>
                    {sessionStatusLabel(session.status, t)}
                    {sessionQuery.isFetching ? ` ${t('home.stateRefreshing')}` : ''}
                  </Text>
                  {currentPhase ? (
                    <Text as="div" variant="body-2">
                      <Text as="span" color="secondary">
                        {t('home.currentPhase')}{' '}
                      </Text>
                      {phaseLabel(currentPhase, t)}
                      <Text as="span" color="secondary">
                        {' '}
                        ({phaseStateLabel(currentPhase.state, t)})
                      </Text>
                    </Text>
                  ) : null}
                </Flex>
                <Flex direction="row" gap={3} wrap="wrap" style={{ marginTop: 8 }}>
                  <Button view="action" size="l" component={Link} to={workPath}>
                    {t('home.continueTo')} {primaryNavLabel}
                  </Button>
                  {isOperator && identity.mode === 'interactive' && session && (
                    <Button
                      view="outlined-danger"
                      size="l"
                      disabled={!resetAllowed || resetMutation.isPending}
                      onClick={() => {
                        setResetBanner(null);
                        if (resetAllowed) setResetDialogOpen(true);
                      }}
                    >
                      {t('home.resetConfiguration')}
                    </Button>
                  )}
                </Flex>
                {isOperator && identity.mode === 'interactive' && session && !resetAllowed && (
                  <Text as="div" variant="body-2" color="secondary" style={{ marginTop: 8 }}>
                    {t('home.resetConfigurationBlocked')}
                  </Text>
                )}
                {resetBanner && (
                  <Text
                    as="div"
                    variant="body-2"
                    color={resetBanner.tone === 'success' ? 'positive' : 'danger'}
                    style={{ marginTop: 8 }}
                  >
                    {resetBanner.text}
                  </Text>
                )}
              </>
            ) : null}
          </Flex>
        </Card>
      )}

      <Dialog open={resetDialogOpen} onClose={() => !resetMutation.isPending && setResetDialogOpen(false)}>
        <Dialog.Header caption={t('home.resetConfigurationConfirmTitle')} />
        <Dialog.Body>
          <Flex direction="column" gap={3}>
            <Text as="div" variant="body-2">
              {t('home.resetConfigurationConfirmBody')}
            </Text>
            <Text as="div" variant="body-2" color="secondary">
              {t('home.resetConfigurationHint')}
            </Text>
          </Flex>
        </Dialog.Body>
        <Dialog.Footer
          onClickButtonApply={() => void resetMutation.mutate()}
          textButtonApply={t('home.resetConfigurationConfirmAction')}
          propsButtonApply={{ view: 'outlined-danger', loading: resetMutation.isPending }}
        />
      </Dialog>
    </Flex>
  );
}
