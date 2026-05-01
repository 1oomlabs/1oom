export const API_BASE_URL_ENV_VAR = 'LOOM_API_BASE_URL' as const;
export const AUTO_PUBLISH_ENV_VAR = 'LOOM_ELIZAOS_AUTO_PUBLISH' as const;

export type PricingInput =
  | { type: 'free' }
  | {
      type: 'x402';
      amount: string;
      token: string;
    };

export type ListMarketplaceInput = {
  apiBaseUrl?: string;
  query?: {
    tag?: string;
    author?: string;
    protocol?: string;
    sort?: string;
    limit?: number;
  };
};

export type CreateWorkflowInput = {
  apiBaseUrl?: string;
  prompt: string;
  owner: string;
  chainId: number;
};

export type PublishWorkflowInput = {
  apiBaseUrl?: string;
  workflowId: string;
  author: string;
  tags?: string[];
  pricing?: PricingInput;
};

export type ApiSuccess<T> = {
  ok: true;
  status: number;
  data: T;
};

export type ApiFailure = {
  ok: false;
  code:
    | 'API_BASE_URL_REQUIRED'
    | 'FETCH_UNAVAILABLE'
    | 'API_REQUEST_FAILED'
    | 'API_RESPONSE_INVALID';
  status?: number;
  message: string;
  details?: unknown;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};

type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponseLike>;

function getEnvironmentValue(key: string): string | undefined {
  return (globalThis as typeof globalThis & { process?: ProcessLike }).process?.env?.[key];
}

export function getConfiguredApiBaseUrl(apiBaseUrl?: string): string | undefined {
  const value = apiBaseUrl ?? getEnvironmentValue(API_BASE_URL_ENV_VAR);
  const normalized = value?.trim().replace(/\/+$/, '');

  return normalized || undefined;
}

function getConfiguredFetch(): FetchLike | undefined {
  const candidate = (globalThis as typeof globalThis & { fetch?: unknown }).fetch;

  return typeof candidate === 'function' ? (candidate as FetchLike) : undefined;
}

function toQueryString(query: ListMarketplaceInput['query']): string {
  const params: string[] = [];

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  const serialized = params.join('&');

  return serialized ? `?${serialized}` : '';
}

function buildUrl(apiBaseUrl: string, path: string, query?: ListMarketplaceInput['query']): string {
  return `${apiBaseUrl}${path}${toQueryString(query)}`;
}

async function parseResponse(response: FetchResponseLike): Promise<unknown> {
  if (typeof response.json === 'function') {
    try {
      return await response.json();
    } catch {
      // Fall through to text parsing below.
    }
  }

  const text = typeof response.text === 'function' ? await response.text() : '';

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson<T>(
  apiBaseUrl: string | undefined,
  path: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    query?: ListMarketplaceInput['query'];
  },
): Promise<ApiResult<T>> {
  const baseUrl = getConfiguredApiBaseUrl(apiBaseUrl);

  if (!baseUrl) {
    return {
      ok: false,
      code: 'API_BASE_URL_REQUIRED',
      message: `${API_BASE_URL_ENV_VAR} is required for ElizaOS API-backed actions.`,
    };
  }

  const fetch = getConfiguredFetch();

  if (!fetch) {
    return {
      ok: false,
      code: 'FETCH_UNAVAILABLE',
      message: 'globalThis.fetch is required for ElizaOS API-backed actions.',
    };
  }

  try {
    const response = await fetch(buildUrl(baseUrl, path, init?.query), {
      method: init?.method ?? 'GET',
      headers: init?.headers,
      body: init?.body,
    });
    const data = await parseResponse(response);

    if (!response.ok) {
      return {
        ok: false,
        code: 'API_REQUEST_FAILED',
        status: response.status,
        message: `API request failed with status ${response.status}.`,
        details: data,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: data as T,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'API_REQUEST_FAILED',
      message: error instanceof Error ? error.message : 'API request failed.',
      details: error,
    };
  }
}

export async function listMarketplaceFromApi(
  input: ListMarketplaceInput = {},
): Promise<ApiResult<{ items: unknown[]; total: number }>> {
  const result = await requestJson<{ items?: unknown; total?: unknown }>(
    input.apiBaseUrl,
    '/api/marketplace',
    {
      query: input.query,
    },
  );

  if (!result.ok) {
    return result;
  }

  if (!Array.isArray(result.data.items)) {
    return {
      ok: false,
      code: 'API_RESPONSE_INVALID',
      status: result.status,
      message: 'Marketplace API response must include an items array.',
      details: result.data,
    };
  }

  return {
    ok: true,
    status: result.status,
    data: {
      items: result.data.items,
      total: typeof result.data.total === 'number' ? result.data.total : result.data.items.length,
    },
  };
}

export async function createWorkflowFromApi(
  input: CreateWorkflowInput,
): Promise<ApiResult<{ workflow: unknown; intent?: unknown }>> {
  const result = await requestJson<{ workflow?: unknown; intent?: unknown }>(
    input.apiBaseUrl,
    '/api/workflows',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: input.prompt,
        owner: input.owner,
        chainId: input.chainId,
      }),
    },
  );

  if (!result.ok) {
    return result;
  }

  if (!result.data.workflow || typeof result.data.workflow !== 'object') {
    return {
      ok: false,
      code: 'API_RESPONSE_INVALID',
      status: result.status,
      message: 'Workflow API response must include a workflow object.',
      details: result.data,
    };
  }

  return {
    ok: true,
    status: result.status,
    data: {
      workflow: result.data.workflow,
      intent: result.data.intent,
    },
  };
}

export async function publishWorkflowToMarketplace(
  input: PublishWorkflowInput,
): Promise<ApiResult<{ listing: unknown }>> {
  const result = await requestJson<{ listing?: unknown }>(input.apiBaseUrl, '/api/marketplace', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      workflowId: input.workflowId,
      author: input.author,
      tags: input.tags ?? [],
      pricing: input.pricing ?? { type: 'free' },
    }),
  });

  if (!result.ok) {
    return result;
  }

  if (!result.data.listing || typeof result.data.listing !== 'object') {
    return {
      ok: false,
      code: 'API_RESPONSE_INVALID',
      status: result.status,
      message: 'Marketplace publish API response must include a listing object.',
      details: result.data,
    };
  }

  return {
    ok: true,
    status: result.status,
    data: {
      listing: result.data.listing,
    },
  };
}
