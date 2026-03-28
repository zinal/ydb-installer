import { useQuery } from '@tanstack/react-query';
import { Card, Flex, RadioGroup, Text, TextInput } from '@gravity-ui/uikit';
import { api } from '@/api/client';
import type { ConfigurationDraft } from './configurationDraft';
import { t } from '@/i18n';

type Props = {
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
};

export function ArtifactsStep({ draft, patchDraft, readOnly }: Props) {
  const modesQ = useQuery({
    queryKey: ['metadata', 'artifact-modes'],
    queryFn: () => api.getArtifactModes(),
  });

  const modeOptions =
    modesQ.data?.map((m) => ({ value: m, content: m })) ?? [
      { value: 'download', content: t('wizard.artifacts.mode.download') },
      { value: 'local-archive', content: t('wizard.artifacts.mode.localArchive') },
      { value: 'local-binaries', content: t('wizard.artifacts.mode.localBinaries') },
      { value: 'mirror', content: t('wizard.artifacts.mode.mirror') },
    ];

  return (
    <Card style={{ padding: 16 }}>
      <Text variant="subheader-2" style={{ marginBottom: 12 }}>
        {t('wizard.artifacts.source')}
      </Text>
      <RadioGroup
        disabled={readOnly}
        options={modeOptions}
        value={draft.artifacts.sourceMode}
        onUpdate={(v) =>
          patchDraft((d) => ({
            ...d,
            artifacts: { ...d.artifacts, sourceMode: v },
          }))
        }
      />
      <Flex direction="column" gap={3} style={{ marginTop: 16 }}>
        <TextInput
          label={t('wizard.artifacts.version')}
          value={draft.artifacts.version}
          disabled={readOnly}
          onUpdate={(v) =>
            patchDraft((d) => ({
              ...d,
              artifacts: { ...d.artifacts, version: v },
            }))
          }
        />
        {(draft.artifacts.sourceMode === 'local-archive' ||
          draft.artifacts.sourceMode === 'local-binaries') && (
          <TextInput
            label={t('wizard.artifacts.localPath')}
            value={draft.artifacts.localPath}
            disabled={readOnly}
            onUpdate={(v) =>
              patchDraft((d) => ({
                ...d,
                artifacts: { ...d.artifacts, localPath: v },
              }))
            }
          />
        )}
        {draft.artifacts.sourceMode === 'mirror' && (
          <TextInput
            label={t('wizard.artifacts.mirrorUrl')}
            value={draft.artifacts.mirrorUrl}
            disabled={readOnly}
            onUpdate={(v) =>
              patchDraft((d) => ({
                ...d,
                artifacts: { ...d.artifacts, mirrorUrl: v },
              }))
            }
          />
        )}
      </Flex>
    </Card>
  );
}
