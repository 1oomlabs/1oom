import type { ActionResult, IAgentRuntime, Memory } from '@elizaos/core';

import loomPlugin, {
  API_BASE_URL_ENV_VAR,
  AUTO_PUBLISH_ENV_VAR,
  EXECUTION_MODE_ENV_VAR,
} from './index';

declare const process: {
  env: Record<string, string | undefined>;
};

type FetchCall = {
  url: string;
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
};

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type GlobalWithFetch = typeof globalThis & {
  fetch?: (url: string, init?: FetchCall['init']) => Promise<FetchResponse>;
};

const mockRuntime = {} as IAgentRuntime;
const liveRun = 'live-run';

function mockMessage(text: string): Memory {
  return {
    entityId: '00000000-0000-0000-0000-000000000001',
    roomId: '00000000-0000-0000-0000-000000000002',
    content: {
      text,
      source: 'api-client-smoke-test',
    },
  } as Memory;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getAction(name: string) {
  const action = loomPlugin.actions.find((candidate) => candidate.name === name);
  assert(action, `${name} action must exist`);
  return action;
}

function getData(result: ActionResult | undefined): Record<string, unknown> {
  assert(result?.data, 'action result must include data');
  return result.data as Record<string, unknown>;
}

function createResponse(body: unknown, status = 200): FetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function installFetch(handler: (call: FetchCall) => FetchResponse | Promise<FetchResponse>) {
  const calls: FetchCall[] = [];
  const globalWithFetch = globalThis as GlobalWithFetch;
  const originalFetch = globalWithFetch.fetch;

  globalWithFetch.fetch = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    return handler(call);
  };

  return {
    calls,
    restore() {
      globalWithFetch.fetch = originalFetch;
    },
  };
}

function snapshotEnv(keys: readonly string[]): Record<string, string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

const envKeys = [API_BASE_URL_ENV_VAR, EXECUTION_MODE_ENV_VAR, AUTO_PUBLISH_ENV_VAR] as const;

export async function runApiClientSmokeTests(): Promise<string[]> {
  const passed: string[] = [];
  const envSnapshot = snapshotEnv(envKeys);

  try {
    process.env[API_BASE_URL_ENV_VAR] = 'https://api.example.test';
    process.env[EXECUTION_MODE_ENV_VAR] = liveRun;

    const marketplaceFetch = installFetch((call) => {
      assert(
        call.url === 'https://api.example.test/api/marketplace?protocol=Aave&limit=5',
        'BROWSE_MARKETPLACE live-run must call the configured marketplace API with query params',
      );
      assert(!call.init?.method || call.init.method === 'GET', 'marketplace lookup must use GET');
      return createResponse({
        items: [
          {
            id: 'listing-1',
            workflow: { id: 'workflow-1', templateId: 'aave-recurring-deposit' },
            pricing: { type: 'free' },
          },
        ],
        total: 1,
      });
    });

    try {
      const result = await getAction('BROWSE_MARKETPLACE').handler(
        mockRuntime,
        mockMessage('browse marketplace'),
        undefined,
        { parameters: { protocol: 'Aave', limit: 5 } },
        undefined,
        [],
      );
      const data = getData(result);
      assert(result?.success === true, 'live-run marketplace browse must succeed');
      assert(data.source === 'api', 'marketplace result must be marked as API sourced');
      assert(data.executionMode === liveRun, 'marketplace result must be live-run');
      assert(data.total === 1, 'marketplace result must preserve total');
      assert(Array.isArray(data.items), 'marketplace result must expose items array');
      assert(marketplaceFetch.calls.length === 1, 'marketplace browse must call fetch once');
      passed.push('BROWSE_MARKETPLACE live-run calls GET /api/marketplace');
    } finally {
      marketplaceFetch.restore();
    }

    const workflowFetch = installFetch((call) => {
      assert(call.url === 'https://api.example.test/api/workflows', 'workflow create URL');
      assert(call.init?.method === 'POST', 'workflow create must use POST');
      assert(call.init?.headers?.['content-type'] === 'application/json', 'workflow create JSON');
      const body = JSON.parse(call.init?.body ?? '{}') as Record<string, unknown>;
      assert(body.prompt === 'deposit LINK to Aave', 'workflow create must forward prompt');
      assert(body.owner === '0x0000000000000000000000000000000000000001', 'owner forwarded');
      assert(body.chainId === 11155111, 'chainId forwarded');
      return createResponse(
        {
          workflow: {
            id: 'workflow-1',
            templateId: 'aave-recurring-deposit',
            status: 'deployed',
          },
          intent: { templateId: 'aave-recurring-deposit', confidence: 0.9 },
        },
        201,
      );
    });

    try {
      const result = await getAction('CREATE_WORKFLOW').handler(
        mockRuntime,
        mockMessage('deposit LINK to Aave'),
        undefined,
        {
          parameters: {
            owner: '0x0000000000000000000000000000000000000001',
            chainId: 11155111,
          },
        },
        undefined,
        [],
      );
      const data = getData(result);
      assert(result?.success === true, 'live-run workflow create must succeed');
      assert(data.source === 'api', 'workflow create result must be marked as API sourced');
      assert(data.executionMode === liveRun, 'workflow create result must be live-run');
      assert(workflowFetch.calls.length === 1, 'workflow create must call fetch once');
      passed.push('CREATE_WORKFLOW live-run calls POST /api/workflows');
    } finally {
      workflowFetch.restore();
    }

    process.env[AUTO_PUBLISH_ENV_VAR] = 'true';

    const publishedCalls = installFetch((call) => {
      if (call.url.endsWith('/api/workflows')) {
        return createResponse({ workflow: { id: 'workflow-2' }, intent: {} }, 201);
      }

      assert(call.url === 'https://api.example.test/api/marketplace', 'publish URL');
      assert(call.init?.method === 'POST', 'publish must use POST');
      const body = JSON.parse(call.init?.body ?? '{}') as Record<string, unknown>;
      assert(body.workflowId === 'workflow-2', 'publish must use created workflow ID');
      assert(body.author === '0x0000000000000000000000000000000000000001', 'publish author');
      assert(Array.isArray(body.tags), 'publish tags must be an array');
      return createResponse({ listing: { id: 'listing-2', workflowId: 'workflow-2' } }, 201);
    });

    try {
      const result = await getAction('CREATE_WORKFLOW').handler(
        mockRuntime,
        mockMessage('stake ETH with Lido'),
        undefined,
        {
          parameters: {
            owner: '0x0000000000000000000000000000000000000001',
            chainId: 11155111,
            tags: ['agent-created'],
          },
        },
        undefined,
        [],
      );
      const data = getData(result);
      assert(result?.success === true, 'live-run workflow create with publish must succeed');
      assert(data.marketplaceListing, 'auto-publish must return marketplaceListing');
      assert(
        publishedCalls.calls.length === 2,
        'auto-publish must call workflows then marketplace',
      );
      passed.push('CREATE_WORKFLOW live-run can publish through POST /api/marketplace');
    } finally {
      publishedCalls.restore();
    }

    delete process.env[API_BASE_URL_ENV_VAR];
    delete process.env[AUTO_PUBLISH_ENV_VAR];

    const blocked = await getAction('CREATE_WORKFLOW').handler(
      mockRuntime,
      mockMessage('deposit LINK to Aave'),
      undefined,
      {
        parameters: {
          executionMode: liveRun,
          owner: '0x0000000000000000000000000000000000000001',
          chainId: 11155111,
        },
      },
      undefined,
      [],
    );
    assert(blocked?.success === false, 'missing API base URL must block live-run workflow create');
    assert(blocked?.error === 'API_BASE_URL_REQUIRED', 'missing API base URL must be explicit');
    passed.push('live-run workflow creation blocks when LOOM_API_BASE_URL is missing');
  } finally {
    restoreEnv(envSnapshot);
  }

  return passed;
}
