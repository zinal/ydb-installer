import { Card, Flex, Select, Switch, Text, TextInput } from '@gravity-ui/uikit';
import type { ConfigurationDraft } from './configurationDraft';
import { t } from '@/i18n';

type Props = {
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
};

export function SecurityStep({ draft, patchDraft, readOnly }: Props) {
  const tlsModes = [
    { value: 'installer-generated', content: t('wizard.security.tls.generated') },
    { value: 'operator-provided', content: t('wizard.security.tls.operator') },
    { value: 'existing-pki', content: t('wizard.security.tls.pki') },
  ];

  return (
    <Flex direction="column" gap={4}>
      <Card style={{ padding: 16 }}>
        <Select
          label={t('wizard.security.tlsMode')}
          options={tlsModes}
          value={draft.security.tlsMode ? [draft.security.tlsMode] : []}
          onUpdate={(v) =>
            patchDraft((d) => ({
              ...d,
              security: { ...d.security, tlsMode: v[0] ?? '' },
            }))
          }
          disabled={readOnly}
          width="max"
        />
        {draft.security.tlsMode === 'operator-provided' && (
          <Flex direction="column" gap={2} style={{ marginTop: 12 }}>
            <TextInput
              label={t('wizard.security.certPath')}
              value={draft.security.certPath}
              disabled={readOnly}
              onUpdate={(v) =>
                patchDraft((d) => ({
                  ...d,
                  security: { ...d.security, certPath: v },
                }))
              }
            />
            <TextInput
              label={t('wizard.security.keyPath')}
              type="password"
              value={draft.security.keyPath}
              disabled={readOnly}
              onUpdate={(v) =>
                patchDraft((d) => ({
                  ...d,
                  security: { ...d.security, keyPath: v },
                }))
              }
            />
          </Flex>
        )}
        <Text color="secondary" style={{ marginTop: 12, fontSize: 12 }}>
          {t('wizard.security.uploadHint')}
        </Text>
      </Card>

      <Card style={{ padding: 16 }}>
        <Flex gap={3} alignItems="center" style={{ marginBottom: 12 }}>
          <Text>{t('wizard.security.ydbAuth')}</Text>
          <Switch
            checked={draft.security.ydbAuthEnabled}
            disabled={readOnly}
            onUpdate={(v) =>
              patchDraft((d) => ({
                ...d,
                security: { ...d.security, ydbAuthEnabled: v },
              }))
            }
          />
        </Flex>
        {draft.security.ydbAuthEnabled && (
          <TextInput
            label={t('wizard.security.ydbUser')}
            value={draft.security.ydbUser}
            disabled={readOnly}
            onUpdate={(v) =>
              patchDraft((d) => ({
                ...d,
                security: { ...d.security, ydbUser: v },
              }))
            }
          />
        )}
      </Card>
    </Flex>
  );
}
