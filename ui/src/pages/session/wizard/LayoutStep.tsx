import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Checkbox,
  Flex,
  NumberInput,
  Select,
  Switch,
  Text,
  TextInput,
} from '@gravity-ui/uikit';
import { api, type DiscoveredHost } from '@/api/client';
import type { ConfigurationDraft, NodeRole } from './configurationDraft';
import { t } from '@/i18n';

type Props = {
  hosts: DiscoveredHost[];
  draft: ConfigurationDraft;
  patchDraft: (patch: Partial<ConfigurationDraft> | ((d: ConfigurationDraft) => ConfigurationDraft)) => void;
  readOnly: boolean;
};

function presetOptions() {
  return [
    { value: 'block-4-2-dc', content: t('wizard.layout.preset.block42') },
    { value: 'mirror-3-dc', content: t('wizard.layout.preset.mirror3') },
    { value: 'reduced-mirror-3-dc', content: t('wizard.layout.preset.reducedMirror3') },
    { value: 'bridge', content: t('wizard.layout.preset.bridge') },
  ];
}

export function LayoutStep({ hosts, draft, patchDraft, readOnly }: Props) {
  const topologiesQ = useQuery({
    queryKey: ['metadata', 'topologies'],
    queryFn: () => api.getTopologies(),
  });

  const topologyOptions =
    topologiesQ.data?.map((x) => ({ value: x, content: x })) ?? [
      { value: 'block-4-2', content: 'block-4-2' },
      { value: 'mirror-3-dc', content: 'mirror-3-dc' },
    ];

  const rolesFor = (hostId: string): NodeRole[] =>
    draft.layout.nodeRoles[hostId] ?? ['storage'];

  const setRoles = (hostId: string, key: NodeRole, on: boolean) => {
    patchDraft((d) => {
      const nr = { ...d.layout.nodeRoles };
      const cur = new Set(nr[hostId] ?? ['storage']);
      if (on) cur.add(key);
      else cur.delete(key);
      if (cur.size === 0) cur.add('storage');
      nr[hostId] = [...cur] as NodeRole[];
      return {
        ...d,
        layout: { ...d.layout, nodeRoles: nr },
      };
    });
  };

  return (
    <Flex direction="column" gap={4}>
      <Card style={{ padding: 16 }}>
        <Flex direction="column" gap={3}>
          <Select
            label={t('wizard.layout.preset')}
            options={presetOptions()}
            value={draft.layout.preset ? [draft.layout.preset] : []}
            onUpdate={(v) =>
              patchDraft((d) => ({
                ...d,
                layout: { ...d.layout, preset: v[0] ?? '' },
              }))
            }
            disabled={readOnly}
            width="max"
          />
          <Select
            label={t('wizard.layout.topology')}
            options={topologyOptions}
            value={draft.layout.topology ? [draft.layout.topology] : []}
            onUpdate={(v) =>
              patchDraft((d) => ({
                ...d,
                layout: { ...d.layout, topology: v[0] ?? '' },
              }))
            }
            disabled={readOnly}
            loading={topologiesQ.isLoading}
            width="max"
          />
          <Flex gap={3} alignItems="center">
            <Text>{t('wizard.layout.bridge')}</Text>
            <Switch
              checked={draft.layout.bridgeMode}
              disabled={readOnly}
              onUpdate={(v) => patchDraft((d) => ({ ...d, layout: { ...d.layout, bridgeMode: v } }))}
            />
          </Flex>
        </Flex>
      </Card>

      {draft.layout.bridgeMode && (
        <Card style={{ padding: 16 }}>
          <Text variant="subheader-2" style={{ marginBottom: 12 }}>
            {t('wizard.layout.piles')}
          </Text>
          <Flex direction="column" gap={2}>
            {draft.layout.piles.map((p, i) => (
              <Flex key={`${p.id}-${i}`} gap={2} alignItems="flex-end" wrap="wrap">
                <TextInput
                  label={t('wizard.layout.pileId')}
                  value={p.id}
                  disabled={readOnly}
                  onUpdate={(v) =>
                    patchDraft((d) => {
                      const piles = [...d.layout.piles];
                      piles[i] = { ...piles[i], id: v };
                      return { ...d, layout: { ...d.layout, piles } };
                    })
                  }
                />
                <TextInput
                  label={t('wizard.layout.failureDomain')}
                  value={p.failureDomain}
                  disabled={readOnly}
                  onUpdate={(v) =>
                    patchDraft((d) => {
                      const piles = [...d.layout.piles];
                      piles[i] = { ...piles[i], failureDomain: v };
                      return { ...d, layout: { ...d.layout, piles } };
                    })
                  }
                />
                {!readOnly && draft.layout.piles.length > 1 && (
                  <Button
                    view="outlined-danger"
                    onClick={() =>
                      patchDraft((d) => ({
                        ...d,
                        layout: {
                          ...d.layout,
                          piles: d.layout.piles.filter((_, j) => j !== i),
                        },
                      }))
                    }
                  >
                    {t('wizard.layout.removePile')}
                  </Button>
                )}
              </Flex>
            ))}
            {!readOnly && (
              <Button
                view="outlined"
                onClick={() =>
                  patchDraft((d) => ({
                    ...d,
                    layout: {
                      ...d.layout,
                      piles: [
                        ...d.layout.piles,
                        { id: `pile-${d.layout.piles.length + 1}`, failureDomain: '' },
                      ],
                    },
                  }))
                }
              >
                {t('wizard.layout.addPile')}
              </Button>
            )}
          </Flex>
        </Card>
      )}

      <Card style={{ padding: 16 }}>
        <Text variant="subheader-2" style={{ marginBottom: 12 }}>
          {t('wizard.layout.roles')}
        </Text>
        <Flex direction="column" gap={3}>
          {hosts.map((h) => (
            <Card key={h.hostId} style={{ padding: 12 }}>
              <Text style={{ marginBottom: 8 }}>{h.hostname || h.hostId}</Text>
              <Flex gap={4} wrap="wrap">
                {(['storage', 'compute', 'broker'] as const).map((key) => (
                  <Checkbox
                    key={key}
                    checked={rolesFor(h.hostId).includes(key)}
                    disabled={
                      readOnly || (key === 'storage' && rolesFor(h.hostId).length === 1)
                    }
                    onUpdate={(on) => setRoles(h.hostId, key, on)}
                    content={
                      key === 'storage'
                        ? t('wizard.layout.role.storage')
                        : key === 'compute'
                          ? t('wizard.layout.role.compute')
                          : t('wizard.layout.role.broker')
                    }
                  />
                ))}
              </Flex>
              <NumberInput
                label={t('wizard.layout.computePerHost')}
                style={{ marginTop: 12, maxWidth: 200 }}
                value={draft.layout.computePerHost[h.hostId] ?? 1}
                min={1}
                disabled={readOnly}
                onUpdate={(v) =>
                  patchDraft((d) => ({
                    ...d,
                    layout: {
                      ...d.layout,
                      computePerHost: {
                        ...d.layout.computePerHost,
                        [h.hostId]: typeof v === 'number' && v > 0 ? v : 1,
                      },
                    },
                  }))
                }
              />
            </Card>
          ))}
        </Flex>
      </Card>
    </Flex>
  );
}
