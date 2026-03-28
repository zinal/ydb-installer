import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Flex, Loader, Text, TextInput } from '@gravity-ui/uikit';
import { TreeView } from 'ydb-ui-components';
import { api, TargetHost } from '@/api/client';
import { t } from '@/i18n';
import { useInstallationSession } from '@/session/InstallationSessionProvider';
import { wizardSteps } from './wizardSteps';

function formatBytes(n?: number): string {
  if (n == null || n === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

type TargetsForm = { targets: TargetHost[] };

export function WizardPage() {
  const { sessionId, isLoading: bootLoading, error: bootError } = useInstallationSession();
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.getSession(sessionId!),
    enabled: Boolean(sessionId),
  });

  const discoveryQuery = useQuery({
    queryKey: ['discovery', sessionId],
    queryFn: () => api.getDiscovery(sessionId!),
    enabled: Boolean(sessionId),
  });

  const { register, control, handleSubmit, reset } = useForm<TargetsForm>({
    defaultValues: { targets: [{ address: '', port: 22, user: '' }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'targets' });

  useEffect(() => {
    const tgs = sessionQuery.data?.targets;
    if (tgs && tgs.length > 0) {
      reset({ targets: tgs.map(normalizeTarget) });
    }
  }, [sessionQuery.data, reset]);

  const saveTargets = useMutation({
    mutationFn: (targets: TargetHost[]) => api.setTargets(sessionId!, targets),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });

  const runDiscovery = useMutation({
    mutationFn: () => api.runDiscovery(sessionId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['discovery', sessionId] });
      setStepIndex(2);
    },
  });

  const refreshDiscovery = useMutation({
    mutationFn: () => api.refreshDiscovery(sessionId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['discovery', sessionId] });
    },
  });

  const onSaveTargets = handleSubmit((data) => {
    const cleaned = data.targets
      .map((row) => ({
        address: row.address.trim(),
        port: row.port && row.port > 0 ? row.port : 22,
        user: row.user?.trim() || undefined,
        hostId: row.hostId?.trim() || undefined,
        bastionHost: row.bastionHost?.trim() || undefined,
        bastionUser: row.bastionUser?.trim() || undefined,
      }))
      .filter((r) => r.address.length > 0);
    if (cleaned.length === 0) {
      return;
    }
    saveTargets.mutate(cleaned);
  });

  const session = sessionQuery.data;
  const snapshot = discoveryQuery.data;
  const discoveryPhase = session?.phases?.find((p) => p.phaseId === 2);
  const targetsSaved = (session?.targets?.length ?? 0) > 0;

  if (!sessionId) {
    return (
      <Flex direction="column" gap={4}>
        <Text variant="header-1">{t('wizard.title')}</Text>
        {bootLoading && <Loader size="l" />}
        {bootError && <Text color="danger">{bootError.message}</Text>}
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap={4}>
      <Text variant="header-1">{t('wizard.title')}</Text>
      <Text color="secondary">
        {session?.title ?? t('home.sessionTitle')} · {session?.status ?? '…'}
      </Text>

      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 12 }}>
          {t('wizard.phaseStrip')}
        </Text>
        <Flex direction="column" gap={1}>
          {wizardSteps.map((step, i) => (
            <TreeView
              key={step.id}
              name={t(step.labelKey)}
              title={step.id}
              level={0}
              collapsed={i > stepIndex}
              active={i === stepIndex}
            />
          ))}
        </Flex>
      </Card>

      {session?.phases && session.phases.length > 0 && (
        <Card style={{ padding: 16 }}>
          <Text variant="subheader-2" style={{ marginBottom: 8 }}>
            {t('wizard.sessionPhases')}
          </Text>
          <Flex direction="column" gap={2}>
            {session.phases.map((p) => (
              <Flex key={p.phaseId} gap={3} alignItems="center">
                <Text>{p.name}</Text>
                <Text color="secondary">{p.state}</Text>
                {p.message ? (
                  <Text color="danger" style={{ fontSize: 12 }}>
                    {p.message}
                  </Text>
                ) : null}
              </Flex>
            ))}
          </Flex>
        </Card>
      )}

      {sessionQuery.isLoading && <Loader size="l" />}
      {sessionQuery.error && (
        <Text color="danger">{(sessionQuery.error as Error).message}</Text>
      )}

      {stepIndex === 0 && (
        <Card style={{ padding: 16 }}>
          <Text variant="subheader-2" style={{ marginBottom: 8 }}>
            {t('wizard.step.targets')}
          </Text>
          <Text color="secondary" style={{ marginBottom: 16 }}>
            {t('wizard.targets.help')}
          </Text>
          <form onSubmit={onSaveTargets}>
            <Flex direction="column" gap={3}>
              {fields.map((field, idx) => (
                <Card key={field.id} style={{ padding: 12 }}>
                  <Flex direction="column" gap={2}>
                    <TextInput
                      placeholder="address"
                      {...register(`targets.${idx}.address` as const)}
                      size="l"
                    />
                    <Flex gap={2}>
                      <TextInput
                        placeholder="port"
                        type="number"
                        {...register(`targets.${idx}.port` as const, { valueAsNumber: true })}
                      />
                      <TextInput placeholder="SSH user" {...register(`targets.${idx}.user` as const)} />
                      <TextInput placeholder="host id (optional)" {...register(`targets.${idx}.hostId` as const)} />
                    </Flex>
                    <Flex gap={2}>
                      <TextInput placeholder="bastion host" {...register(`targets.${idx}.bastionHost` as const)} />
                      <TextInput placeholder="bastion user" {...register(`targets.${idx}.bastionUser` as const)} />
                    </Flex>
                    {fields.length > 1 && (
                      <Button view="outlined-danger" type="button" onClick={() => remove(idx)}>
                        Remove
                      </Button>
                    )}
                  </Flex>
                </Card>
              ))}
              <Flex gap={2}>
                <Button
                  type="button"
                  view="outlined"
                  onClick={() =>
                    append({ address: '', port: 22, user: session?.targets?.[0]?.user ?? '' })
                  }
                >
                  {t('wizard.targets.add')}
                </Button>
                <Button view="action" type="submit" loading={saveTargets.isPending}>
                  {t('wizard.targets.save')}
                </Button>
              </Flex>
            </Flex>
          </form>
          <Flex gap={2} style={{ marginTop: 16 }}>
            <Button
              view="action"
              disabled={!targetsSaved}
              onClick={() => setStepIndex(1)}
            >
              {t('wizard.targets.next')}
            </Button>
          </Flex>
        </Card>
      )}

      {stepIndex === 1 && (
        <Card style={{ padding: 16 }}>
          <Text variant="subheader-2" style={{ marginBottom: 8 }}>
            {t('wizard.step.discovery_run')}
          </Text>
          <Text color="secondary" style={{ marginBottom: 12 }}>
            {t('wizard.discovery.hint')}
          </Text>
          {discoveryPhase?.state === 'running' || runDiscovery.isPending || refreshDiscovery.isPending ? (
            <Flex alignItems="center" gap={2}>
              <Loader size="s" />
              <Text>{t('wizard.discovery.running')}</Text>
            </Flex>
          ) : (
            <Flex gap={2}>
              <Button
                view="action"
                size="l"
                disabled={!targetsSaved}
                loading={runDiscovery.isPending}
                onClick={() => runDiscovery.mutate()}
              >
                {t('wizard.discovery.run')}
              </Button>
              <Button
                view="outlined"
                size="l"
                disabled={!targetsSaved}
                loading={refreshDiscovery.isPending}
                onClick={() => refreshDiscovery.mutate()}
              >
                {t('wizard.discovery.refresh')}
              </Button>
            </Flex>
          )}
          {runDiscovery.error && (
            <Text color="danger" style={{ marginTop: 12 }}>
              {(runDiscovery.error as Error).message}
            </Text>
          )}
          <Flex gap={2} style={{ marginTop: 16 }}>
            <Button view="outlined" onClick={() => setStepIndex(0)}>
              {t('wizard.back')}
            </Button>
            <Button view="outlined" onClick={() => setStepIndex(2)} disabled={!snapshot?.collectedAt}>
              {t('wizard.step.discovery_results')}
            </Button>
          </Flex>
        </Card>
      )}

      {stepIndex === 2 && (
        <Card style={{ padding: 16 }}>
          <Text variant="subheader-2" style={{ marginBottom: 8 }}>
            {t('wizard.step.discovery_results')}
          </Text>
          {!snapshot?.collectedAt || !snapshot.hosts?.length ? (
            <Text color="secondary">{t('wizard.results.empty')}</Text>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--g-color-line-generic)' }}>
                    <th style={{ padding: 8 }}>{t('wizard.results.host')}</th>
                    <th style={{ padding: 8 }}>{t('wizard.results.os')}</th>
                    <th style={{ padding: 8 }}>{t('wizard.results.hardware')}</th>
                    <th style={{ padding: 8 }}>{t('wizard.results.disks')}</th>
                    <th style={{ padding: 8 }}>{t('wizard.results.error')}</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.hosts.map((h) => (
                    <tr key={h.hostId} style={{ borderBottom: '1px solid var(--g-color-line-generic)' }}>
                      <td style={{ padding: 8, verticalAlign: 'top' }}>
                        <Text>{h.hostname || h.hostId}</Text>
                        {h.fqdn ? (
                          <Text color="secondary" style={{ fontSize: 12 }}>
                            {h.fqdn}
                          </Text>
                        ) : null}
                      </td>
                      <td style={{ padding: 8, verticalAlign: 'top' }}>
                        {h.osName} {h.osVersion}
                      </td>
                      <td style={{ padding: 8, verticalAlign: 'top' }}>
                        {h.cpus ?? '—'} CPU · {formatBytes(h.memoryBytes)}
                      </td>
                      <td style={{ padding: 8, verticalAlign: 'top', maxWidth: 360 }}>
                        {h.disks?.slice(0, 6).map((d) => (
                          <div key={d.deviceId} style={{ marginBottom: 4 }}>
                            <Text>
                              {d.deviceId} · {formatBytes(d.sizeBytes)} · {d.mediaKind ?? '—'}
                              {d.systemDisk ? ' · system' : ''}
                            </Text>
                            {d.detail ? (
                              <Text color="secondary" style={{ fontSize: 11 }}>
                                {d.detail}
                              </Text>
                            ) : null}
                          </div>
                        ))}
                        {(h.disks?.length ?? 0) > 6 ? (
                          <Text color="secondary">+{h.disks!.length - 6} more</Text>
                        ) : null}
                      </td>
                      <td style={{ padding: 8, verticalAlign: 'top' }}>
                        {h.discoveryError ? <Text color="danger">{h.discoveryError}</Text> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Flex gap={2} style={{ marginTop: 16 }}>
            <Button view="outlined" onClick={() => setStepIndex(1)}>
              {t('wizard.back')}
            </Button>
            <Button view="action" onClick={() => setStepIndex(3)}>
              {t('wizard.results.next')}
            </Button>
          </Flex>
        </Card>
      )}

      {stepIndex >= 3 && (
        <Card style={{ padding: 16 }}>
          <Text variant="subheader-2">{wizardSteps[stepIndex]?.id ?? '…'}</Text>
          <Text color="secondary" style={{ marginTop: 8 }}>
            {t('wizard.placeholder')}
          </Text>
          <Flex gap={2} style={{ marginTop: 16 }}>
            <Button view="outlined" onClick={() => setStepIndex(2)}>
              {t('wizard.back')}
            </Button>
          </Flex>
        </Card>
      )}

      <Flex gap={2}>
        {stepIndex > 0 && stepIndex < 3 && (
          <Button view="flat" onClick={() => setStepIndex((s) => Math.max(0, s - 1))}>
            {t('wizard.back')}
          </Button>
        )}
        {wizardSteps.map((_, i) => (
          <Button
            key={wizardSteps[i].id}
            view={i === stepIndex ? 'action' : 'flat'}
            size="s"
            onClick={() => setStepIndex(i)}
          >
            {i + 1}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
}

function normalizeTarget(t: TargetHost): TargetHost {
  return {
    address: t.address ?? '',
    port: t.port && t.port > 0 ? t.port : 22,
    user: t.user ?? '',
    hostId: t.hostId ?? '',
    bastionHost: t.bastionHost ?? '',
    bastionUser: t.bastionUser ?? '',
  };
}
