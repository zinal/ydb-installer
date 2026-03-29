import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Button, Flex, Loader, Stepper, Text } from '@gravity-ui/uikit';
import { api, type InstallationMode, type TargetHost } from '@/api/client';
import {
  clampStructuralWizardStep,
  DISCOVERY_ACK_STORAGE_KEY,
  EXECUTION_STARTED_STORAGE_KEY,
  migrateLegacyWizardStepIndex,
  readWizardMaxReached,
  WIZARD_STEP_STORAGE_KEY,
  writeWizardMaxReached,
} from '@/navigation/wizardStepStorage';
import { t } from '@/i18n';
import { useInstallationSession } from '@/session/InstallationSessionProvider';
import { useAuthSession } from '@/session/AuthSessionProvider';
import { wizardSteps } from './wizardSteps';
import { initialConfigurationDraft, type ConfigurationDraft } from './wizard/configurationDraft';
import { canReachStep, hasCommittedOrDraftTargets } from './wizard/stepValidation';
import { TargetsStep } from './wizard/TargetsStep';
import { DiscoveryStep } from './wizard/DiscoveryStep';
import { LayoutStep } from './wizard/LayoutStep';
import { StorageStep } from './wizard/StorageStep';
import { NetworkStep } from './wizard/NetworkStep';
import { SecurityStep } from './wizard/SecurityStep';
import { ArtifactsStep } from './wizard/ArtifactsStep';
import { DatabaseStep } from './wizard/DatabaseStep';
import { ReviewStep } from './wizard/ReviewStep';
import { RunStateStep } from './wizard/RunStateStep';
import type { TargetFormRow, TargetsForm } from './wizard/targetForm';
import { parseHostPort } from './wizard/parseHostPort';

function normalizeTarget(t: TargetHost): TargetFormRow {
  const parsed = parseHostPort(t.address ?? '');
  const port = t.port && t.port > 0 ? t.port : parsed.explicitPort ? parsed.port : 22;
  return {
    address: parsed.host.trim(),
    sshPort: port,
    user: t.user ?? '',
    sshPassword: undefined,
    sshKeySelected: false,
  };
}

export function ConfigurationWizard() {
  const { sessionId, isLoading: bootLoading, error: bootError } = useInstallationSession();
  const { role, identity } = useAuthSession();
  const mode: InstallationMode = identity?.mode ?? 'interactive';

  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  /** After session + discovery are ready, initial wizard step is applied from URL or sessionStorage. */
  const [wizardStepReady, setWizardStepReady] = useState(false);
  const prevPersistedStep = useRef<number | null>(null);
  /** Avoids re-inferring SSH auth mode on every render; keyed to loaded session targets. */
  const inferredTargetAuthSig = useRef<string | null>(null);
  const prevSessionIdRef = useRef<string | null>(null);
  /** After a real session id change, skip one persist so we do not write stale max under the new id. */
  const skipNextMaxPersistRef = useRef(false);
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
    defaultValues: {
      targets: [{ address: '', sshPort: 22, user: '', sshPassword: '', sshKeySelected: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'targets' });
  const watchedTargets = useWatch({ control, name: 'targets' });

  const session = sessionQuery.data;
  const snapshot = discoveryQuery.data;
  const configReadOnly = role !== 'operator' || mode === 'batch' || session?.mode === 'batch';
  const runControlsReadOnly = role !== 'operator';

  useEffect(() => {
    setWizardStepReady(false);
    prevPersistedStep.current = null;
    inferredTargetAuthSig.current = null;
    if (sessionId != null) {
      if (prevSessionIdRef.current !== null && prevSessionIdRef.current !== sessionId) {
        setMaxReachedStep(0);
        skipNextMaxPersistRef.current = true;
      }
      prevSessionIdRef.current = sessionId;
    } else {
      prevSessionIdRef.current = null;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const stored = readWizardMaxReached(sessionId);
    if (stored > 0) {
      setMaxReachedStep((m) => Math.max(m, stored));
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    if (skipNextMaxPersistRef.current) {
      skipNextMaxPersistRef.current = false;
      return;
    }
    writeWizardMaxReached(sessionId, maxReachedStep);
  }, [sessionId, maxReachedStep]);

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
      if (Number.isFinite(n)) desired = migrateLegacyWizardStepIndex(n);
    } else {
      try {
        const raw = sessionStorage.getItem(WIZARD_STEP_STORAGE_KEY);
        if (raw != null && Number.isFinite(parseInt(raw, 10))) {
          desired = migrateLegacyWizardStepIndex(parseInt(raw, 10));
        }
      } catch {
        /* ignore */
      }
    }

    const next = configReadOnly
      ? Math.min(wizardSteps.length - 1, Math.max(0, desired))
      : clampStructuralWizardStep(desired, session, snapshot);
    setStepIndex(next);
    setMaxReachedStep((m) => Math.max(m, next));
    setWizardStepReady(true);
  }, [sessionId, session, snapshot, discoveryQuery.isLoading, wizardStepReady, searchParams, configReadOnly]);

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
    const migrated = migrateLegacyWizardStepIndex(n);
    const next = configReadOnly
      ? Math.min(wizardSteps.length - 1, Math.max(0, migrated))
      : clampStructuralWizardStep(migrated, session, snapshot);
    setStepIndex((s) => (s !== next ? next : s));
  }, [searchParams, sessionId, session, snapshot, wizardStepReady, configReadOnly]);

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
        const port = row.port && row.port > 0 ? row.port : 22;
        const user = (row.user ?? '').trim();
        const defPort = d.defaultSsh.port;
        const defUser = d.defaultSsh.user.trim();
        next[f.id] = port === defPort && user === defUser ? 'default' : 'password';
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
        sessionStorage.setItem(WIZARD_STEP_STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
      setStepIndex(1);
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
      const fid = fields[idx]?.id;
      const raw = fid ? draft.targetAuthModeByFieldId[fid] : undefined;
      const mode =
        raw === 'password' || raw === 'secret_key' || raw === 'agent' || raw === 'default'
          ? raw
          : 'default';
      const trimmedHost = row.address.trim();
      if (!trimmedHost.length) {
        return;
      }
      const port =
        mode === 'default'
          ? draft.defaultSsh.port
          : row.sshPort > 0
            ? row.sshPort
            : 22;
      cleaned.push({
        address: trimmedHost,
        port,
        user: row.user?.trim() || undefined,
      });
    });
    if (cleaned.length === 0) {
      return;
    }
    saveTargets.mutate(cleaned);
  });

  const discoveryPhase = session?.phases?.find((p) => p.phaseId === 2);
  const targetsSaved = hasCommittedOrDraftTargets(session, watchedTargets);

  const canNavigateToStep = useCallback(
    (i: number) => {
      if (i < 0 || i >= wizardSteps.length) return false;
      if (configReadOnly) return true;
      return canReachStep(i, session, snapshot, draft, watchedTargets);
    },
    [configReadOnly, session, snapshot, draft, watchedTargets],
  );

  const trySetStep = useCallback(
    (i: number) => {
      if (!sessionId) return;
      if (!canNavigateToStep(i)) {
        setNavHint(t('wizard.nav.blocked'));
        return;
      }
      setNavHint(null);
      setStepIndex(i);
    },
    [sessionId, canNavigateToStep],
  );

  const goNext = useCallback(() => {
    const next = stepIndex + 1;
    if (next < wizardSteps.length && canNavigateToStep(next)) {
      setNavHint(null);
      setStepIndex(next);
    } else {
      setNavHint(t('wizard.nav.completeOrInvalid'));
    }
  }, [stepIndex, canNavigateToStep]);

  const goBack = useCallback(() => {
    setStepIndex((s) => Math.max(0, s - 1));
    setNavHint(null);
  }, []);

  const onStartExecution = useCallback(() => {
    try {
      sessionStorage.setItem(EXECUTION_STARTED_STORAGE_KEY, '1');
      sessionStorage.setItem(WIZARD_STEP_STORAGE_KEY, '9');
    } catch {
      /* ignore */
    }
    patchDraft((d) => ({ ...d, executionStarted: true }));
    setStepIndex(9);
  }, [patchDraft]);

  const startExecutionMutation = useMutation({
    mutationFn: () => api.startExecution(sessionId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['session', sessionId] });
      void qc.invalidateQueries({ queryKey: ['progress', sessionId] });
      onStartExecution();
    },
  });

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
            readOnly={configReadOnly}
            onCommitTargets={configReadOnly ? () => {} : onSaveTargets}
          />
        );
      case 1:
        return (
          <DiscoveryStep
            sessionTargets={session?.targets}
            snapshot={snapshot}
            draft={draft}
            patchDraft={patchDraft}
            readOnly={configReadOnly}
            targetsSaved={targetsSaved}
            discoveryPhase={discoveryPhase}
            runDiscoveryPending={runDiscovery.isPending}
            refreshDiscoveryPending={refreshDiscovery.isPending}
            onRunDiscovery={() => runDiscovery.mutate()}
            onRefreshDiscovery={() => refreshDiscovery.mutate()}
            runError={runDiscovery.error as Error | null}
          />
        );
      case 2:
        return <LayoutStep hosts={hosts} draft={draft} patchDraft={patchDraft} readOnly={configReadOnly} />;
      case 3:
        return <StorageStep hosts={hosts} draft={draft} patchDraft={patchDraft} readOnly={configReadOnly} />;
      case 4:
        return <NetworkStep draft={draft} patchDraft={patchDraft} readOnly={configReadOnly} />;
      case 5:
        return <SecurityStep draft={draft} patchDraft={patchDraft} readOnly={configReadOnly} />;
      case 6:
        return <ArtifactsStep draft={draft} patchDraft={patchDraft} readOnly={configReadOnly} />;
      case 7:
        return <DatabaseStep draft={draft} patchDraft={patchDraft} readOnly={configReadOnly} />;
      case 8:
        return (
          <ReviewStep
            sessionId={sessionId}
            draft={draft}
            patchDraft={patchDraft}
            onStartExecution={() => startExecutionMutation.mutate()}
            readOnly={runControlsReadOnly}
            modeReadOnly={false}
          />
        );
      case 9:
        return <RunStateStep sessionId={sessionId} readOnly={runControlsReadOnly} />;
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
    configReadOnly,
    runControlsReadOnly,
    mode,
    targetsSaved,
    discoveryPhase,
    runDiscovery,
    refreshDiscovery,
    startExecutionMutation,
    onSaveTargets,
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
        {configReadOnly && (
          <Text variant="body-2" color="complementary">
            {t('auth.readOnlyBadge')}
          </Text>
        )}
      </Flex>

      <div className="wizard-stepper-scroll">
        <Stepper value={String(stepIndex)} onUpdate={(id) => trySetStep(Number(id))}>
          {wizardSteps.map((step, i) => {
            /* Success = strictly before furthest reached step. Current step keeps success when
               revisiting an earlier configured step (read-only); only steps at the frontier stay idle. */
            const completed = i < maxReachedStep;
            return (
              <Stepper.Item
                key={step.id}
                id={String(i)}
                view={completed ? 'success' : 'idle'}
                disabled={configReadOnly ? false : !canNavigateToStep(i)}
              >
                {t(step.labelKey)}
              </Stepper.Item>
            );
          })}
        </Stepper>
      </div>

      {stepIndex === 1 && (
        <Text color="secondary" className="wizard-step-hint">
          {t('wizard.discovery.hint')}
        </Text>
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
        {stepIndex < wizardSteps.length - 1 && (
          <Button view="action" disabled={!canNavigateToStep(stepIndex + 1)} onClick={goNext}>
            {t('wizard.next')}
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
