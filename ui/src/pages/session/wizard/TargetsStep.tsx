import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Dialog,
  Flex,
  NumberInput,
  RadioGroup,
  Text,
  TextInput,
} from '@gravity-ui/uikit';
import type {
  Control,
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import type { TargetsForm } from './targetForm';
import type { ConfigurationDraft, DefaultSshAuthMode, TargetRowAuthMode } from './configurationDraft';
import { splitImportLines } from './parseImportHostLines';
import { defaultSshSummaryLines, rowSshSummaryLines } from './targetSshSummary';
import { t } from '@/i18n';

type Props = {
  register: UseFormRegister<TargetsForm>;
  control: Control<TargetsForm>;
  setValue: UseFormSetValue<TargetsForm>;
  fields: FieldArrayWithId<TargetsForm, 'targets', 'id'>[];
  append: UseFieldArrayAppend<TargetsForm, 'targets'>;
  remove: UseFieldArrayRemove;
  defaultTemplateUser: string;
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
  onCommitTargets: () => void;
};

function normalizeRowAuthMode(raw: string | undefined): TargetRowAuthMode {
  if (raw === 'password' || raw === 'secret_key' || raw === 'agent' || raw === 'default') {
    return raw;
  }
  if (raw === 'custom') return 'password';
  return 'default';
}

const DEFAULT_SSH_MODES: DefaultSshAuthMode[] = ['password', 'secret_key', 'agent'];

function SshSummaryBlock({ lines }: { lines: string[] }) {
  return (
    <Flex direction="column" gap={1} className="installer-ssh-summary">
      {lines.map((line, i) => (
        <Text key={i} style={{ fontSize: 14, lineHeight: 1.5 }}>
          {line}
        </Text>
      ))}
    </Flex>
  );
}

export function TargetsStep({
  register,
  control,
  setValue,
  fields,
  append,
  remove,
  defaultTemplateUser,
  draft,
  patchDraft,
  readOnly,
  onCommitTargets,
}: Props) {
  const targets = useWatch({ control, name: 'targets' }) ?? [];
  const [editingDefaults, setEditingDefaults] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [defaultKeyLabel, setDefaultKeyLabel] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const defaultKeyInputRef = useRef<HTMLInputElement>(null);
  const rowKeyInputRef = useRef<HTMLInputElement>(null);

  const dialogOpen = editIndex !== null;

  useEffect(() => {
    patchDraft((d) => {
      let changed = false;
      const next = { ...d.targetAuthModeByFieldId };
      for (const f of fields) {
        const cur = next[f.id] as string | undefined;
        if (cur === undefined) {
          next[f.id] = 'default';
          changed = true;
        } else if (cur === 'custom') {
          next[f.id] = 'password';
          changed = true;
        }
      }
      return changed ? { ...d, targetAuthModeByFieldId: next } : d;
    });
  }, [fields, patchDraft]);

  const authModeForRow = (fieldId: string) => normalizeRowAuthMode(draft.targetAuthModeByFieldId[fieldId]);

  const defaultBlockAuthOptions = DEFAULT_SSH_MODES.map((value) => ({
    value,
    content:
      value === 'password'
        ? t('wizard.targets.authModePassword')
        : value === 'secret_key'
          ? t('wizard.targets.authModeSecretKey')
          : t('wizard.targets.authModeAgent'),
  }));

  const rowAuthOptions = (['default', 'password', 'secret_key', 'agent'] as const).map((value) => ({
    value,
    content:
      value === 'default'
        ? t('wizard.targets.authModeDefault')
        : value === 'password'
          ? t('wizard.targets.authModePassword')
          : value === 'secret_key'
            ? t('wizard.targets.authModeSecretKey')
            : t('wizard.targets.authModeAgent'),
  }));

  const onAddRow = () => {
    append({
      address: '',
      sshPort: draft.defaultSsh.port,
      user: draft.defaultSsh.user || defaultTemplateUser,
      sshPassword: '',
      sshKeySelected: false,
    });
  };

  const closeImportDialog = () => {
    setImportDialogOpen(false);
    setImportText('');
  };

  const applyImportHosts = () => {
    const existing = new Set<string>();
    for (const row of targets) {
      const a = row.address?.trim();
      if (a) existing.add(a.toLowerCase());
    }
    const seenInPaste = new Set<string>();
    const hostnames: string[] = [];
    for (const line of splitImportLines(importText)) {
      const key = line.toLowerCase();
      if (existing.has(key) || seenInPaste.has(key)) continue;
      seenInPaste.add(key);
      hostnames.push(line);
    }
    const port = draft.defaultSsh.port;
    const user = draft.defaultSsh.user || defaultTemplateUser;
    for (const address of hostnames) {
      append({
        address,
        sshPort: port,
        user,
        sshPassword: '',
        sshKeySelected: false,
      });
    }
    closeImportDialog();
    if (!readOnly && hostnames.length > 0) {
      window.setTimeout(() => {
        onCommitTargets();
      }, 0);
    }
  };

  const onRemoveRow = (idx: number) => {
    const fid = fields[idx]?.id;
    remove(idx);
    if (fid) {
      patchDraft((d) => {
        const next = { ...d.targetAuthModeByFieldId };
        delete next[fid];
        return { ...d, targetAuthModeByFieldId: next };
      });
    }
    if (!readOnly) {
      window.setTimeout(() => {
        onCommitTargets();
      }, 0);
    }
  };

  const closeEdit = () => setEditIndex(null);

  const confirmEditDialog = () => {
    if (!readOnly) {
      onCommitTargets();
    }
    closeEdit();
  };

  const finishEditingDefaults = () => {
    if (!readOnly) {
      onCommitTargets();
    }
    setEditingDefaults(false);
  };

  const editIdx = editIndex;
  const editFieldId = editIdx !== null ? fields[editIdx]?.id : undefined;
  const editMode = editFieldId ? authModeForRow(editFieldId) : 'default';
  const rowPortValue =
    editIdx !== null && targets[editIdx]
      ? editMode === 'default'
        ? draft.defaultSsh.port
        : targets[editIdx].sshPort > 0
          ? targets[editIdx].sshPort
          : 22
      : 22;

  const renderDefaultPasswordField = () =>
    draft.defaultSsh.authMode === 'password' ? (
      <TextInput
        label={t('wizard.field.sshPassword')}
        type="password"
        placeholder={t('wizard.targets.passwordPlaceholder')}
        {...register('defaultSshPassword', {
          onChange: (e) => {
            const v = String((e.target as HTMLInputElement).value);
            patchDraft((d) => ({
              ...d,
              defaultSsh: { ...d.defaultSsh, passwordSet: Boolean(v.trim()) },
            }));
          },
        })}
      />
    ) : null;

  const renderDefaultSecretKeyField = () =>
    draft.defaultSsh.authMode === 'secret_key' ? (
      <Flex direction="column" gap={1}>
        <input
          ref={defaultKeyInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pem,.key,*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setDefaultKeyLabel(f ? t('wizard.targets.keySelected') : null);
            if (f) {
              patchDraft((d) => ({
                ...d,
                defaultSsh: { ...d.defaultSsh, keySelected: true },
              }));
            }
          }}
        />
        <Button view="outlined" onClick={() => defaultKeyInputRef.current?.click()}>
          {t('wizard.targets.uploadKey')}
        </Button>
        {defaultKeyLabel && (
          <Text color="secondary" style={{ fontSize: 12 }}>
            {defaultKeyLabel}
          </Text>
        )}
        <Text color="secondary" style={{ fontSize: 12 }}>
          {t('wizard.targets.keyUploadHint')}
        </Text>
      </Flex>
    ) : null;

  const renderRowPasswordField = () =>
    editMode === 'password' ? (
      <TextInput
        label={t('wizard.field.sshPassword')}
        type="password"
        placeholder={t('wizard.targets.passwordPlaceholder')}
        {...register(`targets.${editIdx!}.sshPassword` as const)}
      />
    ) : null;

  const renderRowSecretKeyField = () =>
    editMode === 'secret_key' ? (
      <Flex direction="column" gap={1}>
        <input
          ref={rowKeyInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pem,.key,*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setValue(`targets.${editIdx!}.sshKeySelected`, Boolean(f));
          }}
        />
        <Button view="outlined" onClick={() => rowKeyInputRef.current?.click()}>
          {t('wizard.targets.uploadKey')}
        </Button>
        <Text color="secondary" style={{ fontSize: 12 }}>
          {t('wizard.targets.keyUploadHint')}
        </Text>
      </Flex>
    ) : null;

  return (
    <Flex direction="column" gap={4}>
      <Text color="secondary">{t('wizard.targets.help')}</Text>

      <Card style={{ padding: 16 }}>
        <Flex justifyContent="space-between" alignItems="flex-start" style={{ marginBottom: 12 }} wrap="wrap" gap={2}>
          <Text variant="subheader-2">{t('wizard.targets.defaultSsh')}</Text>
          {!readOnly && !editingDefaults && (
            <Button view="outlined" size="s" onClick={() => setEditingDefaults(true)}>
              {t('wizard.targets.editDefaults')}
            </Button>
          )}
        </Flex>

        {!editingDefaults || readOnly ? (
          <SshSummaryBlock lines={defaultSshSummaryLines(draft, t)} />
        ) : (
          <Flex direction="column" gap={3} style={{ maxWidth: 520 }}>
            <Text variant="subheader-2">{t('wizard.targets.sshConnectionSection')}</Text>
            <RadioGroup
              options={defaultBlockAuthOptions}
              value={draft.defaultSsh.authMode}
              onUpdate={(v) =>
                patchDraft((d) => ({
                  ...d,
                  defaultSsh: { ...d.defaultSsh, authMode: v as DefaultSshAuthMode },
                }))
              }
            />
            <Flex gap={2} wrap="wrap">
              <NumberInput
                label={t('wizard.field.sshPort')}
                value={draft.defaultSsh.port}
                onUpdate={(v) =>
                  patchDraft((d) => ({
                    ...d,
                    defaultSsh: { ...d.defaultSsh, port: typeof v === 'number' && v > 0 ? v : 22 },
                  }))
                }
              />
              <div style={{ minWidth: 200, flex: 1 }}>
                <TextInput
                  label={t('wizard.field.sshUser')}
                  value={draft.defaultSsh.user}
                  onUpdate={(v) =>
                    patchDraft((d) => ({
                      ...d,
                      defaultSsh: { ...d.defaultSsh, user: v },
                    }))
                  }
                />
              </div>
            </Flex>
            {renderDefaultPasswordField()}
            {renderDefaultSecretKeyField()}
            <Button view="action" size="s" onClick={finishEditingDefaults}>
              {t('wizard.targets.doneEditingDefaults')}
            </Button>
          </Flex>
        )}
      </Card>

      <Card style={{ padding: 16 }}>
        <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }} wrap="wrap" gap={2}>
          <Text variant="subheader-2">{t('wizard.targets.hostList')}</Text>
          {!readOnly && (
            <Flex gap={2} wrap="wrap">
              <Button view="outlined" onClick={() => setImportDialogOpen(true)}>
                {t('wizard.targets.importHosts')}
              </Button>
              <Button view="outlined" onClick={onAddRow}>
                {t('wizard.targets.add')}
              </Button>
            </Flex>
          )}
        </Flex>

        <div style={{ overflowX: 'auto' }}>
          <table className="installer-targets-table">
            <thead>
              <tr>
                <th>{t('wizard.targets.tableAddress')}</th>
                <th>{t('wizard.targets.tableSshConnection')}</th>
                {!readOnly && <th>{t('wizard.targets.tableActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {fields.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 2 : 3}>
                    <Text color="secondary">{t('wizard.targets.emptyTable')}</Text>
                  </td>
                </tr>
              ) : (
                fields.map((field, idx) => {
                  const row = targets[idx];
                  const mode = authModeForRow(field.id);
                  const lines = row
                    ? rowSshSummaryLines(row, mode, t)
                    : defaultSshSummaryLines(draft, t);
                  return (
                    <tr key={field.id}>
                      <td>{row?.address?.trim() || '—'}</td>
                      <td className="installer-ssh-summary-cell">
                        <SshSummaryBlock lines={lines} />
                      </td>
                      {!readOnly && (
                        <td>
                          <Flex gap={1} wrap="wrap">
                            <Button size="s" view="outlined" onClick={() => setEditIndex(idx)}>
                              {t('wizard.targets.edit')}
                            </Button>
                            <Button size="s" view="outlined-danger" type="button" onClick={() => onRemoveRow(idx)}>
                              {t('wizard.targets.remove')}
                            </Button>
                          </Flex>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onClose={closeEdit}>
        <Dialog.Header caption={t('wizard.targets.editHost')} />
        <Dialog.Body>
          {editIdx !== null && fields[editIdx] && (
            <Flex direction="column" gap={3}>
              <TextInput
                label={t('wizard.field.address')}
                placeholder={t('wizard.targets.addressPlaceholder')}
                size="l"
                {...register(`targets.${editIdx}.address` as const)}
              />

              <Text variant="subheader-2">{t('wizard.targets.sshConnectionSection')}</Text>
              <RadioGroup
                options={rowAuthOptions}
                value={editMode}
                onUpdate={(v) => {
                  const fid = fields[editIdx].id;
                  const mode = v as TargetRowAuthMode;
                  patchDraft((d) => ({
                    ...d,
                    targetAuthModeByFieldId: { ...d.targetAuthModeByFieldId, [fid]: mode },
                  }));
                  if (mode === 'default') {
                    setValue(`targets.${editIdx}.sshPassword`, '');
                    setValue(`targets.${editIdx}.sshKeySelected`, false);
                    setValue(`targets.${editIdx}.sshPort`, draft.defaultSsh.port);
                  }
                }}
              />

              <Flex gap={2} wrap="wrap">
                <NumberInput
                  label={t('wizard.field.sshPort')}
                  value={rowPortValue}
                  disabled={editMode === 'default'}
                  onUpdate={(v) => {
                    if (editMode === 'default') return;
                    setValue(
                      `targets.${editIdx}.sshPort`,
                      typeof v === 'number' && v > 0 ? v : 22,
                    );
                  }}
                />
                <div style={{ minWidth: 200, flex: 1 }}>
                  <TextInput
                    label={t('wizard.field.sshUser')}
                    {...register(`targets.${editIdx}.user` as const)}
                  />
                </div>
              </Flex>

              {renderRowPasswordField()}
              {renderRowSecretKeyField()}
            </Flex>
          )}
        </Dialog.Body>
        <Dialog.Footer
          onClickButtonApply={confirmEditDialog}
          textButtonApply={t('wizard.dialog.done')}
          propsButtonApply={{ view: 'action' }}
        />
      </Dialog>

      <Dialog open={importDialogOpen} onClose={closeImportDialog}>
        <Dialog.Header caption={t('wizard.targets.importHostsTitle')} />
        <Dialog.Body>
          <Flex direction="column" gap={2}>
            <Text color="secondary" style={{ fontSize: 13 }}>
              {t('wizard.targets.importHostsHint')}
            </Text>
            <label htmlFor="installer-import-hosts" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Text variant="subheader-2">{t('wizard.targets.importHostsLabel')}</Text>
              <textarea
                id="installer-import-hosts"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={12}
                style={{
                  width: '100%',
                  minWidth: 280,
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  lineHeight: 1.5,
                  padding: '8px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--g-color-line-generic)',
                  background: 'var(--g-color-base-background)',
                  color: 'var(--g-color-text-primary)',
                }}
              />
            </label>
          </Flex>
        </Dialog.Body>
        <Dialog.Footer
          textButtonCancel={t('wizard.dialog.cancel')}
          onClickButtonCancel={closeImportDialog}
          textButtonApply={t('wizard.targets.importHostsApply')}
          onClickButtonApply={applyImportHosts}
          propsButtonApply={{ view: 'action' }}
        />
      </Dialog>
    </Flex>
  );
}
