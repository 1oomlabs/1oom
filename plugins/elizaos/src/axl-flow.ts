import { keccak256, stringToBytes } from 'viem';

type AxlWorkflowDraftInput = {
  templateId: string;
  templateName: string;
  protocol: string;
  category: string;
  chainId: number | null;
  network: string | null;
  parameters: Record<string, unknown>;
  trigger: unknown;
  actions: readonly unknown[];
  runtimePlaceholderValues: readonly unknown[];
  contracts: readonly unknown[];
  unsupportedOperations: readonly string[];
};

export type AxlFlowMetadata = {
  protocol: 'gensyn-axl';
  mode: 'dry-run-only';
  transport: 'raw-message';
  nodeApi: {
    topology: 'GET /topology';
    send: 'POST /send';
    recv: 'GET /recv';
    mcp: 'POST /mcp/{peer_id}/{service}';
    a2a: 'POST /a2a/{peer_id}';
  };
  blockedBy: string[];
};

export type RegistryHints = {
  contract: 'MarketplaceRegistry';
  registerFunction: 'register(bytes32,string)';
  curationFlow: 'register -> pending -> curator approveListing -> discoverable';
  contentHashAlgorithm: 'keccak256(canonical workflow JSON)';
  uriScheme: 'loom://workflow/{templateId}/{contentHash}';
};

export type OnchainPublishDraft = {
  contentHash: `0x${string}`;
  uri: string;
  expectedStatus: 'Pending';
  author: 'runtime-signer-required';
  registerCall: {
    contract: 'MarketplaceRegistry';
    functionName: 'register';
    args: [`0x${string}`, string];
  };
  blockedBy: string[];
};

export type AxlEnvelopeDraft = {
  version: 'loomlabs.axl.v1';
  kind: 'loom.workflow.publish' | 'loom.workflow.discover';
  transport: 'axl.raw';
  route: {
    sendEndpoint: '/send';
    recvEndpoint: '/recv';
    destinationPeerId: 'runtime-peer-id-required';
  };
  payload: {
    contentHash: `0x${string}`;
    uri: string;
    workflow: CanonicalWorkflowPayload;
  };
};

export type AxlPublishDraft = {
  axlFlow: AxlFlowMetadata;
  registryHints: RegistryHints;
  onchainPublishDraft: OnchainPublishDraft;
  axlEnvelopeDraft: AxlEnvelopeDraft;
  canonicalWorkflowJson: string;
};

type CanonicalWorkflowPayload = {
  templateId: string;
  templateName: string;
  protocol: string;
  category: string;
  chainId: number | null;
  network: string | null;
  parameters: Record<string, unknown>;
  trigger: unknown;
  actions: readonly unknown[];
  runtimePlaceholderValues: readonly unknown[];
  contracts: readonly unknown[];
  unsupportedOperations: readonly string[];
};

export function createAxlPublishDraft(input: AxlWorkflowDraftInput): AxlPublishDraft {
  const workflow: CanonicalWorkflowPayload = {
    templateId: input.templateId,
    templateName: input.templateName,
    protocol: input.protocol,
    category: input.category,
    chainId: input.chainId,
    network: input.network,
    parameters: input.parameters,
    trigger: input.trigger,
    actions: input.actions,
    runtimePlaceholderValues: input.runtimePlaceholderValues,
    contracts: input.contracts,
    unsupportedOperations: input.unsupportedOperations,
  };
  const canonicalWorkflowJson = stableStringify(workflow);
  const contentHash = keccak256(stringToBytes(canonicalWorkflowJson));
  const uri = `loom://workflow/${input.templateId}/${contentHash}`;

  return {
    axlFlow: createAxlFlowMetadata(),
    registryHints: createRegistryHints(),
    onchainPublishDraft: {
      contentHash,
      uri,
      expectedStatus: 'Pending',
      author: 'runtime-signer-required',
      registerCall: {
        contract: 'MarketplaceRegistry',
        functionName: 'register',
        args: [contentHash, uri],
      },
      blockedBy: ['no-signer', 'no-rpc', 'no-transaction-broadcast'],
    },
    axlEnvelopeDraft: {
      version: 'loomlabs.axl.v1',
      kind: 'loom.workflow.publish',
      transport: 'axl.raw',
      route: {
        sendEndpoint: '/send',
        recvEndpoint: '/recv',
        destinationPeerId: 'runtime-peer-id-required',
      },
      payload: {
        contentHash,
        uri,
        workflow,
      },
    },
    canonicalWorkflowJson,
  };
}

export function createAxlDiscoveryMetadata(): Pick<AxlPublishDraft, 'axlFlow' | 'registryHints'> & {
  axlEnvelopeDraft: Pick<AxlEnvelopeDraft, 'version' | 'kind' | 'transport' | 'route'>;
} {
  return {
    axlFlow: createAxlFlowMetadata(),
    registryHints: createRegistryHints(),
    axlEnvelopeDraft: {
      version: 'loomlabs.axl.v1',
      kind: 'loom.workflow.discover',
      transport: 'axl.raw',
      route: {
        sendEndpoint: '/send',
        recvEndpoint: '/recv',
        destinationPeerId: 'runtime-peer-id-required',
      },
    },
  };
}

function createAxlFlowMetadata(): AxlFlowMetadata {
  return {
    protocol: 'gensyn-axl',
    mode: 'dry-run-only',
    transport: 'raw-message',
    nodeApi: {
      topology: 'GET /topology',
      send: 'POST /send',
      recv: 'GET /recv',
      mcp: 'POST /mcp/{peer_id}/{service}',
      a2a: 'POST /a2a/{peer_id}',
    },
    blockedBy: ['no-axl-node', 'no-peer-id', 'dry-run-only'],
  };
}

function createRegistryHints(): RegistryHints {
  return {
    contract: 'MarketplaceRegistry',
    registerFunction: 'register(bytes32,string)',
    curationFlow: 'register -> pending -> curator approveListing -> discoverable',
    contentHashAlgorithm: 'keccak256(canonical workflow JSON)',
    uriScheme: 'loom://workflow/{templateId}/{contentHash}',
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableJson(value));
}

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableJson);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortForStableJson(nestedValue)]),
  );
}
