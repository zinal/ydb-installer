import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Button, Flex, Loader, Stepper, Text } from '@gravity-ui/uikit';
import { api, type TargetHost } from '@/api/client';
import {
  clampStructuralWizardStep,
  DISCOVERY_ACK_STORAGE_KEY,
  EXECUTION_STARTED_STORAGE_KEY,
  WIZARD_STEP_STORAGE_KEY,
} from '@/navigation/wizardStepStorage';
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
import type { TargetFormRow, TargetsForm } from './wizard/targetForm';
import { formatAddressForForm, parseHostPort } from './wizard/parseHostPort';
function normalizeTarget(t: TargetHost): TargetFormRow {
  return {
    address: formatAddressForForm(t),
    user: t.user ?? '',
    sshPassword: undefined,
    sshKeySelected: false,
  };
}

export function ConfigurationWizard() {
  const { sessionId, isLoading: bootLoading, error: bootError } = useInstallationSession();
  const { role } = useAuthPrototype();
  const readOnly = role !== 'operator';

  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  /** After session + discovery are ready, initial wizard step is applied from URL or sessionStorage. */
  const [wizardStepReady, setWizardStepReady] = useState(false);
  const prevPersistedStep = useRef<number | null>(null);
  /** Avoids re-inferring SSH auth mode on every render; keyed to loaded session targets. */
  const inferredTargetAuthSig = useRef<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  /** Furthest step index the operator has reached (for Stepper success markers). */
  const [maxReachedStep, setMaxReachedStep] = useState(0);
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

  const { register, control, handleSubmit, reset, setValue } = useForm<TargetsForm>({
    defaultValues: { targets: [{ address: '', user: '', sshPassword: '', sshKeySelected: false }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'targets' });

  const session = sessionQuery.data;
  const snapshot = discoveryQuery.data;

  useEffect(() => {
    setWizardStepReady(false);
    prevPersistedStep.current = null;
    inferredTargetAuthSig.current = null;
  }, [sessionId]);

  useEffect(() => {
    setMaxReachedStep((m) => Math.max(m, stepIndex));
  }, [stepIndex]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISCOVERY_ACK_STORAGE_KEY) === '1') {
        patchDraft((d) => ({ ...d, discoveryAcknowledged: true }));
      }
      if (sessionStorage.getItem(EXECUTION_STARTED_STORAGE_KEY) === '1') {
        patchDraft((d) => ({ ...d, executionStarted: true }));
      }
    } catch {
      /* ignore */
    }
  }, [patchDraft]);

  useEffect(() => {
    if (!sessionId || !session) return;
    if (discoveryQuery.isLoading) return;
    if (wizardStepReady) return;

    const param = searchParams.get('step');
    let desired = 0;
    if (param != null) {
      const n = parseInt(param, 10);
      if (Number.isFinite(n)) desired = n;
    } else {
      try {
        const raw = sessionStorage.getItem(WIZARD_STEP_STORAGE_KEY);
        if (raw != null && Number.isFinite(parseInt(raw, 10))) desired = parseInt(raw, 10);
      } catch {
        /* ignore */
      }
    }

    const next = clampStructuralWizardStep(desired, session, snapshot);
    setStepIndex(next);
    setWizardStepReady(true);
  }, [sessionId, session, snapshot, discoveryQuery.isLoading, wizardStepReady, searchParams]);

  useEffect(() => {
    if (!sessionId || !wizardStepReady) return;
    const cur = searchParams.get('step');
    if (cur === String(stepIndex)) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', String(stepIndex));
    setSearchParams(nextParams, { replace: true });
  }, [sessionId, wizardStepReady, stepIndex, searchParams, setSearchParams]);

  useEffect(() => {
    if (!sessionId || !session || !wizardStepReady) return;
    const param = searchParams.get('step');
    if (param == null) return;
    const n = parseInt(param, 10);
    if (!Number.isFinite(n)) return;
    const next = clampStructuralWizardStep(n, session, snapshot);
    setStepIndex((s) => (s !== next ? next : s));
  }, [searchParams, sessionId, session, snapshot, wizardStepReady]);

  useEffect(() => {
    if (!sessionId) return;
    if (prevPersistedStep.current === null) {
      prevPersistedStep.current = stepIndex;
      return;
    }
    if (prevPersistedStep.current === stepIndex) return;
    prevPersistedStep.current = stepIndex;
    try {
      sessionStorage.setItem(WIZARD_STEP_STORAGE_KEY, String(stepIndex));
    } catch {
      /* ignore */
    }
  }, [sessionId, stepIndex]);

  useEffect(() => {
    const tgs = sessionQuery.data?.targets;
    if (tgs && tgs.length > 0) {
      reset({ targets: tgs.map(normalizeTarget) });
    }
  }, [sessionQuery.data, reset]);

  useEffect(() => {
    const tgs = sessionQuery.data?.targets;
    if (!tgs?.length || !sessionId) return;
    if (fields.length !== tgs.length) return;
    const sig = `${sessionId}:${JSON.stringify(
      tgs.map((x) => [x.address, x.port ?? null, x.user ?? '']),
    )}`;
    if (inferredTargetAuthSig.current === sig) return;
    inferredTargetAuthSig.current = sig;

    patchDraft((d) => {
      const next = { ...d.targetAuthModeByFieldId };
      fields.forEach((f, i) => {
        const row = tgs[i]!;
        const formatted = formatAddressForForm(row);
        const { port: p, explicitPort } = parseHostPort(formatted);
        const user = (row.user ?? '').trim();
        const defPort = d.defaultSsh.port;
        const defUser = d.defaultSsh.user.trim();
        const effectivePort = explicitPort ? p : defPort;
        next[f.id] = effectivePort === defPort && user === defUser ? 'default' : 'password';
      });
      return { ...d, targetAuthModeByFieldId: next };
    });
  }, [sessionQuery.data?.targets, fields, sessionId, patchDraft]);

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
      try {
        sessionStorage.setItem(WIZARD_STEP_STORAGE_KEY, '2');
      } catch {
        /* ignore */
      }
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
    const cleaned: TargetHost[] = [];
    data.targets.forEach((row, idx) => {
      const { host, port: parsedPort, explicitPort } = parseHostPort(row.address);
      const port = explicitPort ? parsedPort : draft.defaultSsh.port;
      const trimmedHost = host.trim();
      if (!trimmedHost.length) {
        return;
      }
      cleaned.push({
        address: trimmedHost,
        port,
        user: row.user?.trim() || undefined,
        hostId: String(idx + 1),
      });
    });
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
    try {
      sessionStorage.setItem(EXECUTION_STARTED_STORAGE_KEY, '1');
      sessionStorage.setItem(WIZARD_STEP_STORAGE_KEY, '10');
    } catch {
      /* ignore */
    }
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
            control={control}
            setValue={setValue}
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
      <Flex direction="column" gap={2}>
        <Text variant="header-1">{t('wizard.title')}</Text>
        {readOnly && (
          <Text variant="body-2" color="complementary">
            {t('auth.readOnlyBadge')}
          </Text>
        )}
      </Flex>

      <div className="wizard-stepper-scroll">
        <Stepper value={String(stepIndex)} onUpdate={(id) => trySetStep(Number(id))}>
          {wizardSteps.map((step, i) => {
            const completed = i !== stepIndex && i < maxReachedStep;
            return (
              <Stepper.Item
                key={step.id}
                id={String(i)}
                view={completed ? 'success' : 'idle'}
                disabled={!canReachStep(i, session, snapshot, draft)}
              >
                {t(step.labelKey)}
              </Stepper.Item>
            );
          })}
        </Stepper>
      </div>

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
