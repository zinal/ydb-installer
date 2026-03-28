import { Card, Flex, RadioGroup, Text, TextInput } from '@gravity-ui/uikit';
import type { ConfigurationDraft, NetworkModel } from './configurationDraft';
import { t } from '@/i18n';

type Props = {
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
};

export function NetworkStep({ draft, patchDraft, readOnly }: Props) {
  return (
    <Card style={{ padding: 16 }}>
      <Text variant="subheader-2" style={{ marginBottom: 12 }}>
        {t('wizard.network.model')}
      </Text>
      <RadioGroup
        disabled={readOnly}
        options={[
          { value: 'single', content: t('wizard.network.single') },
          { value: 'separated', content: t('wizard.network.separated') },
        ]}
        value={draft.network.model}
        onUpdate={(v) =>
          patchDraft((d) => ({
            ...d,
            network: { ...d.network, model: v as NetworkModel },
          }))
        }
      />
      <Flex direction="column" gap={3} style={{ marginTop: 16 }}>
        <TextInput
          label={t('wizard.network.frontFqdn')}
          value={draft.network.frontFqdn}
          disabled={readOnly}
          onUpdate={(v) =>
            patchDraft((d) => ({ ...d, network: { ...d.network, frontFqdn: v } }))
          }
        />
        {draft.network.model === 'separated' && (
          <TextInput
            label={t('wizard.network.backFqdn')}
            value={draft.network.backFqdn}
            disabled={readOnly}
            onUpdate={(v) =>
              patchDraft((d) => ({ ...d, network: { ...d.network, backFqdn: v } }))
            }
          />
        )}
        <TextInput
          label={t('wizard.network.extraListeners')}
          value={draft.network.extraListeners}
          disabled={readOnly}
          placeholder={t('wizard.network.extraPlaceholder')}
          onUpdate={(v) =>
            patchDraft((d) => ({ ...d, network: { ...d.network, extraListeners: v } }))
          }
        />
      </Flex>
    </Card>
  );
}
