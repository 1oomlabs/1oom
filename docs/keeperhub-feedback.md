# KeeperHub builder feedback — loomlabs hackathon submission

> Submitted to the KeeperHub Builder Feedback Bounty.
>
> This document collects friction points and feature gaps we hit while
> building loomlabs against the KeeperHub Workflows API during the
> hackathon. Every item is grounded in our integration code
> (`packages/keeperhub-client/src/index.ts`) and reproducible with the
> public docs.
>
> Tone: we genuinely like the product and chose KeeperHub as the
> execution layer for our agent marketplace. The notes below are honest,
> not consolation. Items are ordered by how much time they cost us.

## What we built and how KeeperHub fits

`loomlabs` compiles natural-language prompts into `Workflow` objects, then
deploys each one to KeeperHub via `POST /workflows/create`. Every "Run now"
click in the UI maps to `POST /workflow/{id}/execute`, and the workflow
detail page polls `GET /workflows/{id}` every 5s for live status. The
typed wrapper lives at `packages/keeperhub-client/src/index.ts` (~140
lines, three public methods).

So we touched the deploy + execute + status loop end-to-end. The four
categories below are the surface area we wish behaved differently.

---

## 1. UX / API friction

### 1a. Endpoint singular vs plural is inconsistent
Within the same Workflows API:
- create / list / get use `workflows` (plural): `POST /workflows/create`,
  `GET /workflows/{id}`.
- execute uses `workflow` (singular): `POST /workflow/{id}/execute`.

We caught this only after the execute call silently returned 404 because
we naturally extrapolated `/workflows/{id}/execute`. The console error was
unhelpful (no body, just a 404). It cost us ~30 minutes of bisecting our
own client because we assumed our request was wrong before we doubted the
URL convention.

> Code reference: `packages/keeperhub-client/src/index.ts:78` —
> `// POST /workflow/{id}/execute (단수 'workflow' 주의 — 다른 endpoint와 다름)`

**Suggestion**: pick one (we'd vote `workflows` plural everywhere) and
deprecate the other with a 308 redirect, or at minimum surface a 4xx
explaining the path mismatch.

### 1b. `nodes` and `edges` are required but undocumented
`POST /workflows/create` rejects requests without a `nodes` and `edges`
array, and accepts them as empty arrays — at which point KeeperHub
auto-creates a Manual trigger node. We had to discover this by trial.

```ts
// packages/keeperhub-client/src/index.ts:42-49
async deployWorkflow(workflow: Workflow): Promise<DeployResult> {
  const res = await this.request<unknown>('/workflows/create', {
    method: 'POST',
    body: JSON.stringify({
      name: workflow.name,
      description: workflow.description ?? `...`,
      nodes: [],
      edges: [],
    }),
  });
```

**Suggestion**: document the empty-array shortcut in the API docs, or
make `nodes`/`edges` optional defaulting to `[]` server-side. The current
state penalises first-time integrators.

---

## 2. Response shape is inconsistent

Different endpoints return either `{ data: { ... } }` envelopes or bare
objects, with no obvious rule. This is reproducible: we observed both
shapes from the same workflow creation flow when iterating between
deploy and status checks. We wrote `extractId` and `extractField`
helpers that try `obj.id` first, then `obj.data.id`:

```ts
// packages/keeperhub-client/src/index.ts:118-141
function extractId(res: unknown): string | undefined {
  if (!res || typeof res !== 'object') return undefined;
  const obj = res as Record<string, unknown>;
  if (typeof obj.id === 'string') return obj.id;
  const data = obj.data;
  if (data && typeof data === 'object' && 'id' in data) {
    const id = (data as Record<string, unknown>).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}
```

**Suggestion**: pick one envelope convention (we'd suggest `{ data, error }`
JSON:API-ish since you sometimes already return `{ data: ... }`). Document
it once at the top of the API reference. This is the kind of
inconsistency that compounds — every new endpoint we wired up needed the
same defensive parsing.

---

## 3. Documentation gaps

### 3a. `status` field is sometimes missing on `GET /workflows/{id}`
We expected a canonical `status` enum on `GET /workflows/{id}` so we
could surface live state to users. Instead we get `status` sometimes,
and `enabled: boolean` other times. Our wrapper falls back gracefully:

```ts
// packages/keeperhub-client/src/index.ts:62-73
async getJobStatus(jobId: string): Promise<JobStatusResult> {
  const res = await this.request<unknown>(`/workflows/${jobId}`);
  const status = extractField(res, 'status');
  if (status !== undefined) {
    return { jobId, status: String(status) };
  }
  const enabled = extractField(res, 'enabled');
  if (typeof enabled === 'boolean') {
    return { jobId, status: enabled ? 'active' : 'inactive' };
  }
  return { jobId, status: 'unknown' };
}
```

This means our UI often shows `live: unknown` because the response
shape varies between workflows. **Suggestion**: document which states
are reachable, when each field appears, and which is canonical.

### 3b. Error response format
We don't know whether a 4xx returns a JSON body, plaintext, or nothing.
We wrap every failure with our own `[keeperhub] {status} {statusText}: {body}`
prefix because the server response varies. A documented error envelope
(`{ code, message }` or similar) would let us map specific failures to
useful UI errors.

```ts
// packages/keeperhub-client/src/index.ts:108-114
const res = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
if (!res.ok) {
  const body = await res.text().catch(() => '');
  throw new Error(`[keeperhub] ${res.status} ${res.statusText}: ${body}`);
}
```

### 3c. Rate limits
We never hit one (small demo), but we couldn't find documentation on:
- Per-minute / per-day caps.
- Whether `429` includes `Retry-After`.
- Whether bursts are smoothed or hard-rejected.

For a demo this is fine; for production agents calling KeeperHub
autonomously this is critical. **Suggestion**: a short "Limits" page in
docs.

---

## 4. Feature requests

### 4a. Native pause / resume
There is no `POST /workflows/{id}/pause` or `PATCH {enabled: false}`.
Our app exposes pause / resume buttons because users expect them, but we
had to make them store-only flags:

```ts
// packages/keeperhub-client/src/index.ts:91-99
async pauseJob(_jobId: string): Promise<void> { return; }
async resumeJob(_jobId: string): Promise<void> { return; }
```

This means our UI shows "paused" while KeeperHub keeps running the job —
we are technically lying to our users. The workaround is to delete the
job and re-create it on resume, which loses execution history and makes
the keeperJobId unstable.

**Suggestion**: a single `PATCH /workflows/{id}` that accepts
`{ enabled: false }` would solve this. Both Sky / MakerDAO-style
production users and hackathon teams need this primitive.

### 4b. Workflow delete from API
We can create workflows via API but not delete them. When our app
deletes a workflow row from our DB, the corresponding KeeperHub job
stays around forever and has to be cleaned up via the dashboard.

```ts
// apps/api/src/routes/workflows.ts:168-181
// 삭제 — 우리 store에서만 제거
// KeeperHub 측 워크플로우는 일단 살려둠 (데모 안정성, 청소는 수동 또는 나중에)
workflowsRouter.delete('/:id', async (c) => {
  /* ... */
});
```

For agent-driven systems where workflows are created / discarded
programmatically, dangling KeeperHub state grows unbounded.

**Suggestion**: `DELETE /workflows/{id}` with cascade behaviour
documented (does it cancel running runs? wait for them?).

### 4c. Bulk PATCH for `nodes` / `edges`
We deploy with empty `nodes`/`edges` and rely on the auto-generated
Manual trigger because filling out the action graph through the API was
not obvious. A documented `PATCH /workflows/{id}` shape that accepts a
full nodes/edges definition would let us push compiled workflow graphs
in one shot rather than having users finish them in the dashboard.

### 4d. Webhooks for execution lifecycle
Our UI polls `GET /workflows/{id}` every 5s for live status. A native
webhook (or SSE stream) for `workflow.executed`, `workflow.failed`,
`workflow.completed` events would let us stop polling and react to real
state changes. This matters more under rate limits.

---

## What worked well

To balance — these things saved us time:

- **Bearer auth is dead simple.** `Authorization: Bearer kh_...`,
  no OAuth dance, no key rotation gotchas. Good for demo + good for
  agents who manage their own keys.
- **The empty-`nodes`/`edges` auto-Manual-trigger** *behaviour*
  (separate from the docs gap) is genuinely the right UX once you know
  about it. One POST and a workflow exists with a sensible default.
- **Workflows are persistent across our server restarts.** We rely on
  the `keeperJobId` being stable forever. This is a quiet win.

---

## How to verify

1. Clone <https://github.com/1oomlabs/1oom>.
2. Read `packages/keeperhub-client/src/index.ts` — every comment marked
   with `KeeperHub ...` corresponds to one of the items above.
3. Run `pnpm dev`, hit `POST /api/workflows` with the demo prompt, watch
   the `[keeperhub]` log lines flow.
4. Workflow lifecycle is logged via `apps/api/src/log.ts` — easy to see
   where each KeeperHub call happens.

---

## Contact

- Repo: <https://github.com/1oomlabs/1oom>
- Live demo: <https://1ooms-web.vercel.app>
- Live API: <https://loomlabsapi-production.up.railway.app>
- Team: liupei8979 + team
