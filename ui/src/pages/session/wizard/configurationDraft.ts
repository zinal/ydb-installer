/** Local prototype draft for steps 4–11; targets remain API-backed (§6.5–§6.6). */

export type NetworkModel = 'single' | 'separated';

export type NodeRole = 'storage' | 'compute' | 'broker';

export interface PileDef {
  id: string;
  failureDomain: string;
}

export interface ConfigurationDraft {
  /** Default SSH (§6.6.1); secrets are UI-only in prototype — never logged. */
  defaultSsh: {
    port: number;
    user: string;
    useAgent: boolean;
    passwordSet: boolean;
  };
  discoveryAcknowledged: boolean;
  layout: {
    preset: string;
    topology: string;
    bridgeMode: boolean;
    piles: PileDef[];
    /** Per discovered host id */
    nodeRoles: Record<string, NodeRole[]>;
    computePerHost: Record<string, number>;
  };
  /** hostId -> selected disk device ids */
  storageByHost: Record<string, string[]>;
  storage: {
    expertOverride: boolean;
    expertDeviceByHost: Record<string, string>;
    partitioning: string;
    diskKindLabel: string;
  };
  network: {
    model: NetworkModel;
    frontFqdn: string;
    backFqdn: string;
    extraListeners: string;
  };
  security: {
    tlsMode: string;
    certPath: string;
    keyPath: string;
    ydbAuthEnabled: boolean;
    ydbUser: string;
  };
  artifacts: {
    sourceMode: string;
    version: string;
    localPath: string;
    mirrorUrl: string;
  };
  database: {
    name: string;
    domainPath: string;
    extraOptions: string;
  };
  review: {
    approveDestructive: boolean;
    confirmPhrase: string;
  };
  /** Simulated preflight for prototype (§6.6.10). */
  preflight: {
    ran: boolean;
    blockingErrors: number;
    warnings: number;
  };
  executionStarted: boolean;
}

export const initialConfigurationDraft = (): ConfigurationDraft => ({
  defaultSsh: {
    port: 22,
    user: '',
    useAgent: true,
    passwordSet: false,
  },
  discoveryAcknowledged: false,
  layout: {
    preset: '',
    topology: '',
    bridgeMode: false,
    piles: [{ id: 'pile-1', failureDomain: 'fd1' }],
    nodeRoles: {},
    computePerHost: {},
  },
  storageByHost: {},
  storage: {
    expertOverride: false,
    expertDeviceByHost: {},
    partitioning: 'gpt',
    diskKindLabel: 'ssd',
  },
  network: {
    model: 'single',
    frontFqdn: '',
    backFqdn: '',
    extraListeners: '',
  },
  security: {
    tlsMode: 'installer-generated',
    certPath: '',
    keyPath: '',
    ydbAuthEnabled: false,
    ydbUser: '',
  },
  artifacts: {
    sourceMode: 'download',
    version: '',
    localPath: '',
    mirrorUrl: '',
  },
  database: {
    name: '',
    domainPath: '',
    extraOptions: '',
  },
  review: {
    approveDestructive: false,
    confirmPhrase: '',
  },
  preflight: {
    ran: false,
    blockingErrors: 0,
    warnings: 0,
  },
  executionStarted: false,
});
