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
};

function normalizeRowAuthMode(raw: string | undefined): TargetRowAuthMode {
  if (raw === 'password' || raw === 'secret_key' || raw === 'agent' || raw === 'default') {
    return raw;
  }
  if (raw === 'custom') return 'password';
  return 'default';
}

const DEFAULT_SSH_MODES: DefaultSshAuthMode[] = ['password', 'secret_key', 'agent'];

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
}: Props) {
  const targets = useWatch({ control, name: 'targets' }) ?? [];
  const [editingDefaults, setEditingDefaults] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [defaultKeyLabel, setDefaultKeyLabel] = useState<string | null>(null);
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

  const summaryDefaultSsh = () => {
    const mode = draft.defaultSsh.authMode;
    const modeLabel =
      mode === 'password'
        ? t('wizard.targets.authModePassword')
        : mode === 'secret_key'
          ? t('wizard.targets.authModeSecretKey')
          : t('wizard.targets.authModeAgent');
    const pwd =
      mode === 'password'
        ? draft.defaultSsh.passwordSet
          ? t('wizard.targets.passwordSet')
          : t('wizard.targets.passwordNotSet')
        : null;
    const key =
      mode === 'secret_key'
        ? draft.defaultSsh.keySelected
          ? t('wizard.targets.keySelected')
          : t('wizard.targets.keyNotSelected')
        : null;
    const parts = [
      `${t('wizard.targets.defaultAuthModeLabel')}: ${modeLabel}`,
      `${t('wizard.field.sshPort')}: ${draft.defaultSsh.port}`,
      `${t('wizard.field.sshUser')}: ${draft.defaultSsh.user.trim() || '—'}`,
    ];
    if (pwd) parts.push(`${t('wizard.field.sshPassword')}: ${pwd}`);
    if (key) parts.push(`${t('wizard.targets.uploadKey')}: ${key}`);
    return parts.join(' · ');
  };

  const authModeForRow = (fieldId: string) => normalizeRowAuthMode(draft.targetAuthModeByFieldId[fieldId]);

  const authModeLabel = (mode: TargetRowAuthMode) => {
    switch (mode) {
      case 'default':
        return t('wizard.targets.authModeDefault');
      case 'password':
        return t('wizard.targets.authModePassword');
      case 'secret_key':
        return t('wizard.targets.authModeSecretKey');
      case 'agent':
        return t('wizard.targets.authModeAgent');
      default:
        return mode;
    }
  };

  const onAddRow = () => {
    append({
      address: '',
      user: draft.defaultSsh.user || defaultTemplateUser,
      sshPassword: '',
      sshKeySelected: false,
    });
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
  };

  const closeEdit = () => setEditIndex(null);

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
    content: authModeLabel(value),
  }));

  const editIdx = editIndex;
  const editFieldId = editIdx !== null ? fields[editIdx]?.id : undefined;
  const editMode = editFieldId ? authModeForRow(editFieldId) : 'default';

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
        <Text color="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
          {t('wizard.targets.defaultSshHint')}
        </Text>

        {!editingDefaults || readOnly ? (
          <Text style={{ fontSize: 14, lineHeight: 1.5 }}>{summaryDefaultSsh()}</Text>
        ) : (
          <Flex direction="column" gap={3} style={{ maxWidth: 520 }}>
            <Text variant="subheader-2">{t('wizard.targets.defaultAuthModeLabel')}</Text>
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
            {draft.defaultSsh.authMode === 'password' && (
              <TextInput
                label={t('wizard.field.sshPassword')}
                type="password"
                placeholder={t('wizard.targets.passwordPlaceholder')}
                onUpdate={() =>
                  patchDraft((d) => ({
                    ...d,
                    defaultSsh: { ...d.defaultSsh, passwordSet: true },
                  }))
                }
              />
            )}
            {draft.defaultSsh.authMode === 'secret_key' && (
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
            )}
            {draft.defaultSsh.authMode === 'agent' && (
              <Text color="secondary" style={{ fontSize: 13 }}>
                {t('wizard.targets.defaultAgentHint')}
              </Text>
            )}
            <Button view="action" size="s" onClick={() => setEditingDefaults(false)}>
              {t('wizard.targets.doneEditingDefaults')}
            </Button>
          </Flex>
        )}
      </Card>

      <Card style={{ padding: 16 }}>
        <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }} wrap="wrap" gap={2}>
          <Text variant="subheader-2">{t('wizard.targets.hostList')}</Text>
          {!readOnly && (
            <Button view="outlined" onClick={onAddRow}>
              {t('wizard.targets.add')}
            </Button>
          )}
        </Flex>

        <div style={{ overflowX: 'auto' }}>
          <table className="installer-targets-table">
            <thead>
              <tr>
                <th>{t('wizard.targets.tableAddress')}</th>
                <th>{t('wizard.targets.tableHostId')}</th>
                <th>{t('wizard.targets.tableUser')}</th>
                <th>{t('wizard.targets.tableAuthMode')}</th>
                {!readOnly && <th>{t('wizard.targets.tableActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {fields.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 4 : 5}>
                    <Text color="secondary">{t('wizard.targets.emptyTable')}</Text>
                  </td>
                </tr>
              ) : (
                fields.map((field, idx) => (
                  <tr key={field.id}>
                    <td>{targets[idx]?.address?.trim() || '—'}</td>
                    <td>{idx + 1}</td>
                    <td>{targets[idx]?.user?.trim() || '—'}</td>
                    <td>{authModeLabel(authModeForRow(field.id))}</td>
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
                ))
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
              <Text color="secondary" style={{ fontSize: 13 }}>
                {t('wizard.targets.hostIdLabel')} {editIdx + 1}
              </Text>
              <TextInput
                label={t('wizard.field.address')}
                placeholder={t('wizard.targets.addressPlaceholder')}
                size="l"
                {...register(`targets.${editIdx}.address` as const)}
              />
              <TextInput
                label={t('wizard.field.sshUser')}
                {...register(`targets.${editIdx}.user` as const)}
              />
              <Text variant="subheader-2">{t('wizard.targets.authMode')}</Text>
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
                  }
                }}
              />
              {editMode === 'password' && (
                <TextInput
                  label={t('wizard.field.sshPassword')}
                  type="password"
                  placeholder={t('wizard.targets.passwordPlaceholder')}
                  {...register(`targets.${editIdx}.sshPassword` as const)}
                />
              )}
              {editMode === 'secret_key' && (
                <Flex direction="column" gap={1}>
                  <input
                    ref={rowKeyInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    accept=".pem,.key,*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setValue(`targets.${editIdx}.sshKeySelected`, Boolean(f));
                    }}
                  />
                  <Button view="outlined" onClick={() => rowKeyInputRef.current?.click()}>
                    {t('wizard.targets.uploadKey')}
                  </Button>
                  <Text color="secondary" style={{ fontSize: 12 }}>
                    {t('wizard.targets.keyUploadHint')}
                  </Text>
                </Flex>
              )}
              {editMode === 'agent' && (
                <Text color="secondary" style={{ fontSize: 13 }}>
                  {t('wizard.targets.rowAgentHint')}
                </Text>
              )}
            </Flex>
          )}
        </Dialog.Body>
        <Dialog.Footer
          onClickButtonApply={closeEdit}
          textButtonApply={t('wizard.dialog.done')}
          propsButtonApply={{ view: 'action' }}
        />
      </Dialog>
    </Flex>
  );
}
