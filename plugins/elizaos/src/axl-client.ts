import type { AxlEnvelopeDraft } from './axl-flow';
import { verifyAxlEnvelopeDraft } from './axl-flow';

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export const DEFAULT_AXL_NODE_URL = 'http://127.0.0.1:9002';

export type AxlRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
};

export type AxlResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get: (name: string) => string | null;
  };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type FetchLike = (input: string, init?: AxlRequestInit) => Promise<AxlResponseLike>;

export type AxlRuntimeConfig = {
  axlNodeUrl: string;
  destinationPeerId?: string;
  loomApiUrl?: string;
  workflowOwner?: string;
  enableAgentExecution: boolean;
  marketplaceRegistryAddress?: string;
};

export type AxlClientOptions = {
  config?: Partial<AxlRuntimeConfig>;
  fetchImpl?: FetchLike;
};

export type AxlSendResult = {
  destinationPeerId: string;
  sentBytes: number | null;
};

export type AxlReceivedMessage = {
  fromPeerId: string | null;
  bodyText: string;
  envelope?: AxlEnvelopeDraft;
};

export type LoomWorkflowExecutionResult = {
  workflow?: unknown;
  intent?: unknown;
};

export function getAxlRuntimeConfig(
  env: Record<string, string | undefined> = getProcessEnv(),
): AxlRuntimeConfig {
  return {
    axlNodeUrl: env.AXL_NODE_URL ?? DEFAULT_AXL_NODE_URL,
    destinationPeerId: env.AXL_DESTINATION_PEER_ID,
    loomApiUrl: env.LOOM_API_URL,
    workflowOwner: env.LOOM_WORKFLOW_OWNER,
    enableAgentExecution: env.ENABLE_AXL_AGENT_EXECUTION === 'true',
    marketplaceRegistryAddress: env.MARKETPLACE_REGISTRY_ADDRESS,
  };
}

export class AxlClient {
  private readonly config: AxlRuntimeConfig;
  private readonly fetchImpl: FetchLike;

  constructor(options: AxlClientOptions = {}) {
    this.config = { ...getAxlRuntimeConfig(), ...options.config };
    this.fetchImpl = options.fetchImpl ?? getGlobalFetch();
  }

  async getTopology(): Promise<unknown> {
    const response = await this.fetchAxl('/topology');
    return response.json();
  }

  async sendEnvelope(envelope: AxlEnvelopeDraft): Promise<AxlSendResult> {
    const destinationPeerId = this.config.destinationPeerId;

    if (!destinationPeerId) {
      throw new Error('AXL_DESTINATION_PEER_ID must be set before sending AXL messages.');
    }

    const body = createTextEncoder().encode(JSON.stringify(envelope));
    const response = await this.fetchAxl('/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-destination-peer-id': destinationPeerId,
      },
      body,
    });
    const sentBytes = response.headers.get('x-sent-bytes');

    return {
      destinationPeerId,
      sentBytes: sentBytes ? Number(sentBytes) : null,
    };
  }

  async receiveMessage(): Promise<AxlReceivedMessage | null> {
    const response = await this.fetchAxl('/recv');

    if (response.status === 204) {
      return null;
    }

    const bodyText = await response.text();
    const envelope = parseAxlEnvelope(bodyText);

    return {
      fromPeerId: response.headers.get('x-from-peer-id'),
      bodyText,
      envelope,
    };
  }

  async executeReceivedWorkflow(message: AxlReceivedMessage): Promise<LoomWorkflowExecutionResult> {
    if (!this.config.enableAgentExecution) {
      throw new Error('ENABLE_AXL_AGENT_EXECUTION=true is required to execute received workflows.');
    }

    if (!this.config.loomApiUrl) {
      throw new Error('LOOM_API_URL must be set to execute received workflows.');
    }

    if (!this.config.workflowOwner) {
      throw new Error('LOOM_WORKFLOW_OWNER must be set to execute received workflows.');
    }

    if (!message.envelope || !verifyAxlEnvelopeDraft(message.envelope)) {
      throw new Error('Received AXL workflow envelope failed contentHash verification.');
    }

    const workflow = message.envelope.payload.workflow;
    const response = await this.fetchImpl(
      `${this.config.loomApiUrl.replace(/\/$/, '')}/api/workflows`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt: createExecutionPrompt(workflow),
          owner: this.config.workflowOwner,
          chainId: workflow.chainId ?? 11155111,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`[loom-api] ${response.status} ${response.statusText}: ${body}`);
    }

    return (await response.json()) as LoomWorkflowExecutionResult;
  }

  private async fetchAxl(path: string, init: AxlRequestInit = {}): Promise<AxlResponseLike> {
    const response = await this.fetchImpl(
      `${this.config.axlNodeUrl.replace(/\/$/, '')}${path}`,
      init,
    );

    if (!response.ok && response.status !== 204) {
      const body = await response.text().catch(() => '');
      throw new Error(`[axl] ${response.status} ${response.statusText}: ${body}`);
    }

    return response;
  }
}

export function parseAxlEnvelope(bodyText: string): AxlEnvelopeDraft | undefined {
  try {
    const parsed = JSON.parse(bodyText) as Partial<AxlEnvelopeDraft>;

    if (
      parsed.version !== 'loomlabs.axl.v1' ||
      parsed.transport !== 'axl.raw' ||
      !parsed.payload ||
      typeof parsed.payload !== 'object'
    ) {
      return undefined;
    }

    return parsed as AxlEnvelopeDraft;
  } catch {
    return undefined;
  }
}

function createExecutionPrompt(workflow: AxlEnvelopeDraft['payload']['workflow']): string {
  return [
    `Execute received AXL workflow ${workflow.templateId} (${workflow.templateName}).`,
    `Parameters: ${JSON.stringify(workflow.parameters)}.`,
  ].join(' ');
}

function getProcessEnv(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : (process.env ?? {});
}

function getGlobalFetch(): FetchLike {
  const fetchImpl = (globalThis as unknown as { fetch?: FetchLike }).fetch;

  if (!fetchImpl) {
    throw new Error('global fetch is unavailable in this runtime.');
  }

  return fetchImpl.bind(globalThis) as FetchLike;
}

function createTextEncoder(): { encode: (input: string) => Uint8Array } {
  const TextEncoderCtor = (
    globalThis as unknown as {
      TextEncoder?: new () => { encode: (input: string) => Uint8Array };
    }
  ).TextEncoder;

  if (!TextEncoderCtor) {
    throw new Error('TextEncoder is unavailable in this runtime.');
  }

  return new TextEncoderCtor();
}
