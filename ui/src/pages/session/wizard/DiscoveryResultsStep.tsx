import { Card, Checkbox, Flex, Text } from '@gravity-ui/uikit';
import type { DiscoverySnapshot } from '@/api/client';
import { DISCOVERY_ACK_STORAGE_KEY } from '@/navigation/wizardStepStorage';
import type { ConfigurationDraft } from './configurationDraft';
import { t } from '@/i18n';

function formatBytes(n?: number): string {
  if (n == null || n === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

type Props = {
  snapshot: DiscoverySnapshot | undefined;
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
};

export function DiscoveryResultsStep({ snapshot, draft, patchDraft, readOnly }: Props) {
  const failedHosts = snapshot?.hosts?.filter((h) => h.discoveryError) ?? [];

  return (
    <Flex direction="column" gap={3}>
      {!snapshot?.collectedAt || !snapshot.hosts?.length ? (
        <Card style={{ padding: 16 }}>
          <Text color="secondary">{t('wizard.results.empty')}</Text>
        </Card>
      ) : (
        <Card style={{ padding: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--g-color-line-generic)' }}>
                  <th style={{ padding: 8 }}>{t('wizard.results.host')}</th>
                  <th style={{ padding: 8 }}>{t('wizard.results.os')}</th>
                  <th style={{ padding: 8 }}>{t('wizard.results.hardware')}</th>
                  <th style={{ padding: 8 }}>{t('wizard.results.disks')}</th>
                  <th style={{ padding: 8 }}>{t('wizard.results.error')}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.hosts.map((h) => (
                  <tr key={h.hostId} style={{ borderBottom: '1px solid var(--g-color-line-generic)' }}>
                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                      <Text>{h.hostname || h.hostId}</Text>
                      {h.fqdn ? (
                        <Text color="secondary" style={{ fontSize: 12 }}>
                          {h.fqdn}
                        </Text>
                      ) : null}
                    </td>
                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                      {h.osName} {h.osVersion}
                    </td>
                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                      {h.cpus ?? '—'} CPU · {formatBytes(h.memoryBytes)}
                    </td>
                    <td style={{ padding: 8, verticalAlign: 'top', maxWidth: 360 }}>
                      {h.disks?.slice(0, 6).map((d) => (
                        <div key={d.deviceId} style={{ marginBottom: 4 }}>
                          <Text>
                            {d.deviceId} · {formatBytes(d.sizeBytes)} · {d.mediaKind ?? '—'}
                            {d.systemDisk ? ' · system' : ''}
                          </Text>
                          {d.detail ? (
                            <Text color="secondary" style={{ fontSize: 11 }}>
                              {d.detail}
                            </Text>
                          ) : null}
                        </div>
                      ))}
                      {(h.disks?.length ?? 0) > 6 ? (
                        <Text color="secondary">+{h.disks!.length - 6} more</Text>
                      ) : null}
                    </td>
                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                      {h.discoveryError ? <Text color="danger">{h.discoveryError}</Text> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {failedHosts.length > 0 && (
        <Card style={{ padding: 12, borderColor: 'var(--g-color-line-warning)' }}>
          <Text color="warning">{t('wizard.results.failedWarning')}</Text>
        </Card>
      )}

      <Card style={{ padding: 16 }}>
        <Flex gap={3} alignItems="center">
          <Checkbox
            checked={draft.discoveryAcknowledged}
            disabled={readOnly || !snapshot?.collectedAt}
            onUpdate={(v) => {
              patchDraft((d) => ({ ...d, discoveryAcknowledged: v }));
              try {
                if (v) {
                  sessionStorage.setItem(DISCOVERY_ACK_STORAGE_KEY, '1');
                } else {
                  sessionStorage.removeItem(DISCOVERY_ACK_STORAGE_KEY);
                }
              } catch {
                /* ignore */
              }
            }}
          />
          <Text>{t('wizard.results.acknowledge')}</Text>
        </Flex>
      </Card>
    </Flex>
  );
}
