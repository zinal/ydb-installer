import { Card, Flex, TextInput } from '@gravity-ui/uikit';
import type { ConfigurationDraft } from './configurationDraft';
import { t } from '@/i18n';

type Props = {
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
};

export function DatabaseStep({ draft, patchDraft, readOnly }: Props) {
  return (
    <Card style={{ padding: 16 }}>
      <Flex direction="column" gap={3}>
        <TextInput
          label={t('wizard.database.name')}
          value={draft.database.name}
          disabled={readOnly}
          onUpdate={(v) =>
            patchDraft((d) => ({
              ...d,
              database: { ...d.database, name: v },
            }))
          }
        />
        <TextInput
          label={t('wizard.database.domainPath')}
          value={draft.database.domainPath}
          disabled={readOnly}
          onUpdate={(v) =>
            patchDraft((d) => ({
              ...d,
              database: { ...d.database, domainPath: v },
            }))
          }
        />
        <TextInput
          label={t('wizard.database.extra')}
          value={draft.database.extraOptions}
          disabled={readOnly}
          onUpdate={(v) =>
            patchDraft((d) => ({
              ...d,
              database: { ...d.database, extraOptions: v },
            }))
          }
        />
      </Flex>
    </Card>
  );
}
