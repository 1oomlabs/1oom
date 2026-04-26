# API hooks layer

> A 3-layer abstraction so adding a new resource is < 30 lines and inherits
> caching, invalidation, retries, auth, and typed errors automatically.

## Layers

```
┌──────────────────────────────────────────────────────────┐
│ 1. ApiClient       fetch wrapper, headers, retry, errors │
├──────────────────────────────────────────────────────────┤
│ 2. Resource<T>     CRUD shape bound to a path            │
│    └─ extend to add resource-specific methods            │
├──────────────────────────────────────────────────────────┤
│ 3. makeResourceHooks(resource)                           │
│    └─ TanStack Query hooks: useList / useOne / useCreate │
│       / useUpdate / useRemove / useInvalidate            │
└──────────────────────────────────────────────────────────┘
```

Files live under `apps/web/src/api/`:

```
api/
├── client.ts          ApiClient (HTTP)
├── errors.ts          ApiError class
├── resource.ts        Resource<T> base class
├── keys.ts            makeQueryKeys factory
├── hooks.ts           makeResourceHooks factory
├── resources/
│   ├── workflows.ts   WorkflowsResource extends Resource (with run/pause/fork)
│   ├── marketplace.ts MarketplaceResource (with install)
│   ├── agents.ts      AgentsResource (CRUD only)
│   └── llm.ts         non-CRUD (uses ApiClient directly)
└── index.ts           barrel
```

## Adding a new resource

The simplest case (CRUD only):

```ts
// apps/web/src/api/resources/templates.ts
import { apiClient, Resource, makeResourceHooks } from '@/api';

interface Template { id: string; name: string; protocol: string; /* ... */ }

interface TemplateListParams extends Record<string, string | number | boolean | undefined> {
  protocol?: string;
}

class TemplatesResource extends Resource<Template, TemplateListParams> {}

export const templatesResource = new TemplatesResource(apiClient, '/templates');

export const {
  keys: templateKeys,
  useList: useTemplatesList,
  useOne: useTemplate,
  useInvalidate: useInvalidateTemplates,
} = makeResourceHooks<Template, TemplateListParams>(templatesResource);
```

Done. You now have:

- `useTemplatesList({ protocol: 'aave' })` with auto caching by params
- `useTemplate(id)` with auto disable on missing id
- `templateKeys.detail(id)` / `templateKeys.list(params)` for manual invalidation
- `useInvalidateTemplates()` for blanket cache busting

## Adding a custom action

When the resource has non-CRUD endpoints, **extend** the resource and add a
typed method, then expose a hook that uses TanStack Query directly.

See `resources/workflows.ts` for the canonical example. The pattern:

```ts
class WorkflowsResource extends Resource<Workflow> {
  run(id: string): Promise<{ ok: true; runId: string }> {
    return this.client.post(`${this.path}/${encodeURIComponent(id)}/run`);
  }
}

export function useRunWorkflow(options?: MutationOpts<…, string>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => workflowsResource.run(id),
    onSuccess: (data, id, ctx) => {
      qc.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      options?.onSuccess?.(data, id, ctx);
    },
    ...options,
  });
}
```

## Pure action endpoint (no CRUD shape)

For one-shot calls like LLM extraction, skip `Resource` and use `apiClient`
directly. See `resources/llm.ts`.

## Errors

All hooks reject with `ApiError`. It carries `status`, `url`, and an
optional parsed `body`. Branch on `err.isClientError() | isServerError() |
isNetwork()` rather than string-matching messages.

## Auth

Pass a token getter when constructing the client:

```ts
new ApiClient({ baseUrl, getAuthToken: () => store.getState().sessionToken });
```

The getter is called per request, so the latest token is used after sign-in
without recreating the client.

## Custom client (tests, impersonation)

Each resource module exports a `*HooksFor(client)` factory or you can
instantiate the resource against any `ApiClient` directly:

```ts
const altClient = new ApiClient({ baseUrl: '/api/v2' });
const altWorkflows = workflowsHooksFor(altClient);
const result = altWorkflows.useList();
```

## Conventions

- One file per resource under `resources/`.
- Resource path is the API path (e.g. `/workflows`), not the route path.
- Query keys are derived from the resource path; never hand-roll them.
- Mutations always invalidate the relevant key namespace on success.
- Custom mutations live next to the resource that owns them.
- Re-export domain hooks from `api/index.ts` so components only ever
  `import from '@/api'`.
