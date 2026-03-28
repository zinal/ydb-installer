import { Alert, Card, Checkbox, Flex, Switch, Text, TextInput } from '@gravity-ui/uikit';
import type { DiscoveredHost } from '@/api/client';
import type { ConfigurationDraft } from './configurationDraft';
import { t } from '@/i18n';

type Props = {
  hosts: DiscoveredHost[];
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
};

export function StorageStep({ hosts, draft, patchDraft, readOnly }: Props) {
  const toggleDisk = (hostId: string, deviceId: string, on: boolean) => {
    patchDraft((d) => {
      const cur = new Set(d.storageByHost[hostId] ?? []);
      if (on) cur.add(deviceId);
      else cur.delete(deviceId);
      return {
        ...d,
        storageByHost: { ...d.storageByHost, [hostId]: [...cur] },
      };
    });
  };

  return (
    <Flex direction="column" gap={4}>
      <Alert theme="warning" title={t('wizard.storage.safetyTitle')} message={t('wizard.storage.safetyBody')} />

      <Card style={{ padding: 16 }}>
        <Flex gap={3} alignItems="center" style={{ marginBottom: 12 }}>
          <Text>{t('wizard.storage.expertOverride')}</Text>
          <Switch
            checked={draft.storage.expertOverride}
            disabled={readOnly}
            onUpdate={(v) =>
              patchDraft((d) => ({
                ...d,
                storage: { ...d.storage, expertOverride: v },
              }))
            }
          />
        </Flex>
        <Text color="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
          {t('wizard.storage.expertHint')}
        </Text>

        {draft.storage.expertOverride ? (
          <Flex direction="column" gap={3}>
            {hosts.map((h) => (
              <TextInput
                key={h.hostId}
                label={`${h.hostname || h.hostId} — ${t('wizard.storage.deviceId')}`}
                value={draft.storage.expertDeviceByHost[h.hostId] ?? ''}
                disabled={readOnly}
                onUpdate={(v) =>
                  patchDraft((d) => ({
                    ...d,
                    storage: {
                      ...d.storage,
                      expertDeviceByHost: { ...d.storage.expertDeviceByHost, [h.hostId]: v },
                    },
                  }))
                }
              />
            ))}
          </Flex>
        ) : (
          <Flex direction="column" gap={4}>
            {hosts.map((h) => (
              <Card key={h.hostId} style={{ padding: 12 }}>
                <Text variant="subheader-2" style={{ marginBottom: 8 }}>
                  {h.hostname || h.hostId}
                </Text>
                {!h.disks?.length ? (
                  <Text color="secondary">{t('wizard.storage.noDisks')}</Text>
                ) : (
                  <Flex direction="column" gap={2}>
                    {h.disks.map((dsk) => (
                      <Flex key={dsk.deviceId} gap={2} alignItems="flex-start">
                        <Checkbox
                          checked={draft.storageByHost[h.hostId]?.includes(dsk.deviceId) ?? false}
                          disabled={readOnly || Boolean(dsk.systemDisk && !draft.storage.expertOverride)}
                          onUpdate={(on) => toggleDisk(h.hostId, dsk.deviceId, on)}
                          content={
                            <span>
                              <Text>
                                {dsk.deviceId}
                                {dsk.systemDisk ? ` (${t('wizard.storage.systemDisk')})` : ''}
                              </Text>
                              {dsk.mounted ? (
                                <Text color="warning" style={{ fontSize: 12 }}>
                                  {t('wizard.storage.mountedWarning')}
                                </Text>
                              ) : null}
                            </span>
                          }
                        />
                      </Flex>
                    ))}
                  </Flex>
                )}
              </Card>
            ))}
          </Flex>
        )}

        <Flex direction="column" gap={2} style={{ marginTop: 16 }}>
          <Text variant="subheader-2">{t('wizard.storage.partitioning')}</Text>
          <TextInput
            value={draft.storage.partitioning}
            disabled={readOnly}
            onUpdate={(v) =>
              patchDraft((d) => ({ ...d, storage: { ...d.storage, partitioning: v } }))
            }
          />
          <Text variant="subheader-2">{t('wizard.storage.diskKind')}</Text>
          <TextInput
            value={draft.storage.diskKindLabel}
            disabled={readOnly}
            onUpdate={(v) =>
              patchDraft((d) => ({ ...d, storage: { ...d.storage, diskKindLabel: v } }))
            }
          />
        </Flex>
      </Card>
    </Flex>
  );
}
