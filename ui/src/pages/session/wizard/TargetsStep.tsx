import { useState } from 'react';
import {
  Button,
  Card,
  Dialog,
  Flex,
  NumberInput,
  Switch,
  Text,
  TextInput,
} from '@gravity-ui/uikit';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove } from 'react-hook-form';
import type { UseFormRegister } from 'react-hook-form';
import type { TargetHost } from '@/api/client';
import type { ConfigurationDraft } from './configurationDraft';
import { t } from '@/i18n';

type TargetsForm = { targets: TargetHost[] };

type Props = {
  register: UseFormRegister<TargetsForm>;
  fields: FieldArrayWithId<TargetsForm, 'targets', 'id'>[];
  append: UseFieldArrayAppend<TargetsForm, 'targets'>;
  remove: UseFieldArrayRemove;
  defaultTemplateUser: string;
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
};

export function TargetsStep({
  register,
  fields,
  append,
  remove,
  defaultTemplateUser,
  draft,
  patchDraft,
  readOnly,
}: Props) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const open = editIndex !== null;

  return (
    <Flex direction="column" gap={4}>
      <Text color="secondary">{t('wizard.targets.help')}</Text>

      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 12 }}>
          {t('wizard.targets.defaultSsh')}
        </Text>
        <Text color="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
          {t('wizard.targets.defaultSshHint')}
        </Text>
        <Flex direction="column" gap={3} style={{ maxWidth: 480 }}>
          <Flex gap={3} alignItems="center">
            <Text style={{ minWidth: 160 }}>{t('wizard.targets.useAgent')}</Text>
            <Switch
              checked={draft.defaultSsh.useAgent}
              disabled={readOnly}
              onUpdate={(v) =>
                patchDraft((d) => ({
                  ...d,
                  defaultSsh: { ...d.defaultSsh, useAgent: v },
                }))
              }
            />
          </Flex>
          <Flex gap={2} wrap="wrap">
            <NumberInput
              label={t('wizard.field.sshPort')}
              value={draft.defaultSsh.port}
              disabled={readOnly}
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
                disabled={readOnly}
                onUpdate={(v) =>
                  patchDraft((d) => ({
                    ...d,
                    defaultSsh: { ...d.defaultSsh, user: v },
                  }))
                }
              />
            </div>
          </Flex>
          <TextInput
            label={t('wizard.field.sshPassword')}
            type="password"
            placeholder={t('wizard.targets.passwordPlaceholder')}
            disabled={readOnly || draft.defaultSsh.useAgent}
            onUpdate={() =>
              patchDraft((d) => ({
                ...d,
                defaultSsh: { ...d.defaultSsh, passwordSet: true },
              }))
            }
          />
          <Text color="secondary" style={{ fontSize: 12 }}>
            {t('wizard.targets.keyUploadHint')}
          </Text>
        </Flex>
      </Card>

      <Card style={{ padding: 16 }}>
        <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }}>
          <Text variant="subheader-2">{t('wizard.targets.hostList')}</Text>
          {!readOnly && (
            <Button
              view="outlined"
              onClick={() =>
                append({
                  address: '',
                  port: draft.defaultSsh.port,
                  user: draft.defaultSsh.user || defaultTemplateUser,
                })
              }
            >
              {t('wizard.targets.add')}
            </Button>
          )}
        </Flex>
        <Flex direction="column" gap={3}>
          {fields.map((field, idx) => (
            <Card key={field.id} style={{ padding: 12 }}>
              <Flex direction="column" gap={2}>
                <TextInput
                  placeholder={t('wizard.field.address')}
                  {...register(`targets.${idx}.address` as const)}
                  size="l"
                  disabled={readOnly}
                />
                <Flex gap={2} wrap="wrap">
                  <TextInput
                    placeholder={t('wizard.field.sshPort')}
                    type="number"
                    {...register(`targets.${idx}.port` as const, { valueAsNumber: true })}
                    disabled={readOnly}
                  />
                  <TextInput
                    placeholder={t('wizard.field.sshUser')}
                    {...register(`targets.${idx}.user` as const)}
                    disabled={readOnly}
                  />
                  <TextInput
                    placeholder={t('wizard.field.hostId')}
                    {...register(`targets.${idx}.hostId` as const)}
                    disabled={readOnly}
                  />
                </Flex>
                {!readOnly && (
                  <Flex gap={2}>
                    <Button size="s" view="outlined" onClick={() => setEditIndex(idx)}>
                      {t('wizard.targets.edit')}
                    </Button>
                    {fields.length > 1 && (
                      <Button size="s" view="outlined-danger" type="button" onClick={() => remove(idx)}>
                        {t('wizard.targets.remove')}
                      </Button>
                    )}
                  </Flex>
                )}
              </Flex>
            </Card>
          ))}
        </Flex>
      </Card>

      <Dialog open={open} onClose={() => setEditIndex(null)}>
        <Dialog.Header caption={t('wizard.targets.editHost')} />
        <Dialog.Body>
          {editIndex !== null && (
            <Flex direction="column" gap={3}>
              <TextInput
                label={t('wizard.field.address')}
                size="l"
                {...register(`targets.${editIndex}.address` as const)}
              />
              <TextInput
                label={t('wizard.field.sshPort')}
                type="number"
                {...register(`targets.${editIndex}.port` as const, { valueAsNumber: true })}
              />
              <TextInput label={t('wizard.field.sshUser')} {...register(`targets.${editIndex}.user` as const)} />
              <TextInput label={t('wizard.field.hostId')} {...register(`targets.${editIndex}.hostId` as const)} />
              <Text variant="subheader-2">{t('wizard.targets.bastion')}</Text>
              <TextInput
                label={t('wizard.field.bastionHost')}
                {...register(`targets.${editIndex}.bastionHost` as const)}
              />
              <TextInput
                label={t('wizard.field.bastionUser')}
                {...register(`targets.${editIndex}.bastionUser` as const)}
              />
            </Flex>
          )}
        </Dialog.Body>
        <Dialog.Footer
          onClickButtonApply={() => setEditIndex(null)}
          textButtonApply={t('wizard.dialog.done')}
          propsButtonApply={{ view: 'action' }}
        />
      </Dialog>
    </Flex>
  );
}
