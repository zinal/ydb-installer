import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Flex,
  Text,
  TextInput,
} from '@gravity-ui/uikit';
import { api } from '@/api/client';
import type { ConfigurationDraft } from './configurationDraft';
import { t } from '@/i18n';

type Props = {
  sessionId: string;
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  onStartExecution: () => void;
  readOnly: boolean;
};

export function ReviewStep({
  sessionId,
  draft,
  patchDraft,
  onStartExecution,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const preflight = useMutation({
    mutationFn: () => api.runValidation(sessionId),
    onSuccess: () => {
      patchDraft((d) => ({
        ...d,
        preflight: { ran: true, blockingErrors: 0, warnings: 1 },
      }));
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
    },
    onError: () => {
      patchDraft((d) => ({
        ...d,
        preflight: { ran: true, blockingErrors: 1, warnings: 0 },
      }));
    },
  });

  const canStart =
    draft.preflight.ran &&
    draft.preflight.blockingErrors === 0 &&
    draft.review.approveDestructive &&
    draft.review.confirmPhrase.trim().length > 0;

  return (
    <Flex direction="column" gap={4}>
      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 8 }}>
          {t('wizard.review.summary')}
        </Text>
        <Flex direction="column" gap={1}>
          <Text>
            {t('wizard.review.db')}: {draft.database.name || '—'}
          </Text>
          <Text>
            {t('wizard.review.network')}: {draft.network.frontFqdn || '—'}
          </Text>
          <Text>
            {t('wizard.review.topology')}: {draft.layout.topology || '—'}
          </Text>
        </Flex>
      </Card>

      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 8 }}>
          {t('wizard.review.validation')}
        </Text>
        {!draft.preflight.ran ? (
          <Text color="secondary">{t('wizard.review.validationPending')}</Text>
        ) : (
          <Flex direction="column" gap={2}>
            <Text>
              {t('wizard.review.blocking')}: {draft.preflight.blockingErrors}
            </Text>
            <Text>
              {t('wizard.review.warnings')}: {draft.preflight.warnings}
            </Text>
          </Flex>
        )}
        {!readOnly && (
          <Button
            style={{ marginTop: 12 }}
            view="outlined"
            loading={preflight.isPending}
            onClick={() => preflight.mutate()}
          >
            {t('wizard.review.runPreflight')}
          </Button>
        )}
      </Card>

      {draft.preflight.ran && draft.preflight.blockingErrors > 0 && (
        <Alert theme="danger" title={t('wizard.review.blockingTitle')} message={t('wizard.review.blockingBody')} />
      )}

      <Card style={{ padding: 16 }}>
        <Flex gap={3} alignItems="center">
          <Checkbox
            checked={draft.review.approveDestructive}
            disabled={readOnly}
            onUpdate={(v) =>
              patchDraft((d) => ({
                ...d,
                review: { ...d.review, approveDestructive: v },
              }))
            }
            content={t('wizard.review.approveDestructive')}
          />
        </Flex>
        <TextInput
          style={{ marginTop: 12 }}
          label={t('wizard.review.confirmLabel')}
          value={draft.review.confirmPhrase}
          disabled={readOnly}
          onUpdate={(v) =>
            patchDraft((d) => ({
              ...d,
              review: { ...d.review, confirmPhrase: v },
            }))
          }
        />
      </Card>

      {!readOnly && (
        <Button size="l" view="action" disabled={!canStart} onClick={onStartExecution}>
          {t('wizard.review.start')}
        </Button>
      )}
    </Flex>
  );
}
