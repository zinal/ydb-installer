import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Flex, Loader, Stepper, Text } from '@gravity-ui/uikit';
import { api, type TargetHost } from '@/api/client';
import { t } from '@/i18n';
import { useInstallationSession } from '@/session/InstallationSessionProvider';
import { useAuthPrototype } from '@/session/AuthPrototypeProvider';
import { wizardSteps } from './wizardSteps';
import { initialConfigurationDraft, type ConfigurationDraft } from './wizard/configurationDraft';
import { canReachStep } from './wizard/stepValidation';
import { TargetsStep } from './wizard/TargetsStep';
import { DiscoveryRunStep } from './wizard/DiscoveryRunStep';
import { DiscoveryResultsStep } from './wizard/DiscoveryResultsStep';
import { LayoutStep } from './wizard/LayoutStep';
import { StorageStep } from './wizard/StorageStep';
import { NetworkStep } from './wizard/NetworkStep';
import { SecurityStep } from './wizard/SecurityStep';
import { ArtifactsStep } from './wizard/ArtifactsStep';
import { DatabaseStep } from './wizard/DatabaseStep';
import { ReviewStep } from './wizard/ReviewStep';
import { RunStateStep } from './wizard/RunStateStep';

type TargetsForm = { targets: TargetHost[] };

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

export function ConfigurationWizard() {
  const { sessionId, isLoading: bootLoading, error: bootError } = useInstallationSession();
  const { role } = useAuthPrototype();
  const readOnly = role !== 'operator';

  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<ConfigurationDraft>(() => initialConfigurationDraft());
  const [navHint, setNavHint] = useState<string | null>(null);

  const patchDraft = useCallback(
    (update: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => {
      setDraft((d) => (typeof update === 'function' ? update(d) : { ...d, ...update }));
    },
    [],
  );

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

  const snapshot = discoveryQuery.data;
  const session = sessionQuery.data;

  useEffect(() => {
    if (!snapshot?.hosts?.length) return;
    setDraft((d) => {
      const nr = { ...d.layout.nodeRoles };
      for (const h of snapshot.hosts) {
        if (!nr[h.hostId]) nr[h.hostId] = ['storage'];
      }
      return { ...d, layout: { ...d.layout, nodeRoles: nr } };
    });
  }, [snapshot?.hosts]);

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

  const discoveryPhase = session?.phases?.find((p) => p.phaseId === 2);
  const targetsSaved = (session?.targets?.length ?? 0) > 0;

  const trySetStep = useCallback(
    (i: number) => {
      if (!sessionId) return;
      if (!canReachStep(i, session, snapshot, draft)) {
        setNavHint(t('wizard.nav.blocked'));
        return;
      }
      setNavHint(null);
      setStepIndex(i);
    },
    [sessionId, session, snapshot, draft],
  );

  const goNext = useCallback(() => {
    if (readOnly) return;
    const next = stepIndex + 1;
    if (next < wizardSteps.length && canReachStep(next, session, snapshot, draft)) {
      setNavHint(null);
      setStepIndex(next);
    } else {
      setNavHint(t('wizard.nav.completeOrInvalid'));
    }
  }, [readOnly, stepIndex, session, snapshot, draft]);

  const goBack = useCallback(() => {
    setStepIndex((s) => Math.max(0, s - 1));
    setNavHint(null);
  }, []);

  const onStartExecution = useCallback(() => {
    patchDraft((d) => ({ ...d, executionStarted: true }));
    setStepIndex(10);
  }, [patchDraft]);

  const stepContent = useMemo(() => {
    if (!sessionId) return null;
    const hosts = snapshot?.hosts ?? [];

    switch (stepIndex) {
      case 0:
        return (
          <TargetsStep
            register={register}
            fields={fields}
            append={append}
            remove={remove}
            defaultTemplateUser={session?.targets?.[0]?.user ?? ''}
            draft={draft}
            patchDraft={patchDraft}
            readOnly={readOnly}
          />
        );
      case 1:
        return (
          <DiscoveryRunStep
            targetsSaved={targetsSaved}
            discoveryPhase={discoveryPhase}
            runDiscoveryPending={runDiscovery.isPending}
            refreshDiscoveryPending={refreshDiscovery.isPending}
            onRunDiscovery={() => runDiscovery.mutate()}
            onRefreshDiscovery={() => refreshDiscovery.mutate()}
            runError={runDiscovery.error as Error | null}
            readOnly={readOnly}
          />
        );
      case 2:
        return (
          <DiscoveryResultsStep
            snapshot={snapshot}
            draft={draft}
            patchDraft={patchDraft}
            readOnly={readOnly}
          />
        );
      case 3:
        return <LayoutStep hosts={hosts} draft={draft} patchDraft={patchDraft} readOnly={readOnly} />;
      case 4:
        return <StorageStep hosts={hosts} draft={draft} patchDraft={patchDraft} readOnly={readOnly} />;
      case 5:
        return <NetworkStep draft={draft} patchDraft={patchDraft} readOnly={readOnly} />;
      case 6:
        return <SecurityStep draft={draft} patchDraft={patchDraft} readOnly={readOnly} />;
      case 7:
        return <ArtifactsStep draft={draft} patchDraft={patchDraft} readOnly={readOnly} />;
      case 8:
        return <DatabaseStep draft={draft} patchDraft={patchDraft} readOnly={readOnly} />;
      case 9:
        return (
          <ReviewStep
            sessionId={sessionId}
            draft={draft}
            patchDraft={patchDraft}
            onStartExecution={onStartExecution}
            readOnly={readOnly}
          />
        );
      case 10:
        return <RunStateStep readOnly={readOnly} />;
      default:
        return null;
    }
  }, [
    sessionId,
    snapshot,
    stepIndex,
    register,
    fields,
    append,
    remove,
    control,
    session?.targets,
    draft,
    patchDraft,
    readOnly,
    targetsSaved,
    discoveryPhase,
    runDiscovery,
    refreshDiscovery,
    onStartExecution,
  ]);

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
        {readOnly && ` · ${t('auth.readOnlyBadge')}`}
      </Text>

      <div className="wizard-stepper-scroll">
        <Stepper value={String(stepIndex)} onUpdate={(id) => trySetStep(Number(id))}>
          {wizardSteps.map((step, i) => (
            <Stepper.Item
              key={step.id}
              id={String(i)}
              disabled={!canReachStep(i, session, snapshot, draft)}
            >
              {t(step.labelKey)}
            </Stepper.Item>
          ))}
        </Stepper>
      </div>

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

      <div className="wizard-step-panel">{stepContent}</div>

      {navHint && (
        <Text color="danger" style={{ fontSize: 13 }}>
          {navHint}
        </Text>
      )}

      <Flex gap={2} wrap="wrap" alignItems="center">
        {stepIndex > 0 && (
          <Button view="outlined" onClick={goBack}>
            {t('wizard.back')}
          </Button>
        )}
        {stepIndex < wizardSteps.length - 1 && stepIndex !== 9 && (
          <Button view="action" disabled={readOnly} onClick={goNext}>
            {t('wizard.next')}
          </Button>
        )}
        {stepIndex === 0 && (
          <Button view="action" loading={saveTargets.isPending} disabled={readOnly} onClick={onSaveTargets}>
            {t('wizard.targets.save')}
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
