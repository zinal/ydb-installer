import { Button, Card, Checkbox, Flex, Loader, Text } from '@gravity-ui/uikit';
import type { DiscoveredHost, DiscoverySnapshot, SessionPhase, TargetHost } from '@/api/client';
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

function hostColumnLines(
  h: DiscoveredHost,
  sessionTargets: TargetHost[] | undefined,
  index: number,
): string[] {
  const entered = (h.targetAddress ?? sessionTargets?.[index]?.address ?? '').trim();
  const fullName = (h.fqdn?.trim() || h.hostname?.trim() || '').trim() || (h.hostId || '').trim();
  if (!entered) {
    return fullName ? [fullName] : [h.hostId];
  }
  if (!fullName || entered === fullName) {
    return [entered];
  }
  return [entered, fullName];
}

type Props = {
  sessionTargets: TargetHost[] | undefined;
  snapshot: DiscoverySnapshot | undefined;
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
  targetsSaved: boolean;
  discoveryPhase: SessionPhase | undefined;
  runDiscoveryPending: boolean;
  onRunDiscovery: () => void;
  runError: Error | null;
};

export function DiscoveryStep({
  sessionTargets,
  snapshot,
  draft,
  patchDraft,
  readOnly,
  targetsSaved,
  discoveryPhase,
  runDiscoveryPending,
  onRunDiscovery,
  runError,
}: Props) {
  const running = discoveryPhase?.state === 'running' || runDiscoveryPending;
  const failedHosts = snapshot?.hosts?.filter((h) => h.discoveryError) ?? [];

  return (
    <Flex direction="column" gap={4}>
      <Card style={{ padding: 16 }}>
        {running ? (
          <Flex alignItems="center" gap={2}>
            <Loader size="s" />
            <Text>{t('wizard.discovery.running')}</Text>
          </Flex>
        ) : (
          <Flex gap={2} wrap="wrap">
            <Button
              view="action"
              size="l"
              disabled={!targetsSaved || readOnly}
              loading={runDiscoveryPending}
              onClick={onRunDiscovery}
            >
              {t('wizard.discovery.run')}
            </Button>
          </Flex>
        )}
        {runError && (
          <Text color="danger" style={{ marginTop: 12 }}>
            {runError.message}
          </Text>
        )}
      </Card>

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
                  <th style={{ padding: 8 }}>{t('wizard.results.status')}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.hosts.map((h, idx) => {
                  const lines = hostColumnLines(h, sessionTargets, idx);
                  const ok = !h.discoveryError;
                  return (
                    <tr key={h.hostId} style={{ borderBottom: '1px solid var(--g-color-line-generic)' }}>
                      <td style={{ padding: 8, verticalAlign: 'top' }}>
                        {lines.map((line, i) => (
                          <Text key={i} style={{ display: 'block', lineHeight: 1.4 }}>
                            {line}
                          </Text>
                        ))}
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
                        {ok ? (
                          <Text>{t('wizard.results.statusOk')}</Text>
                        ) : (
                          <Text color="danger">{h.discoveryError}</Text>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
