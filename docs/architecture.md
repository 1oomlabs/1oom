# Architecture

## One-line

Natural language compiles to a typed DeFi workflow, deploys to KeeperHub for
execution, and is anchored onchain through a Sepolia `MarketplaceRegistry` so
agents can discover and remix it.

## Components

```
[ User / Agent ]
       |
       | natural language prompt
       v
[ apps/web ]  -- REST -->  [ apps/api ]  -- HTTPS -->  [ KeeperHub ]
   |  ^                       |
   |  | listings, executions  +-- [ packages/llm ]         (Claude Haiku 4.5 intent extraction)
   |  | (polled every 5-10s)  +-- [ packages/templates ]   (3 vetted DeFi templates)
   |  |                       +-- [ packages/keeperhub-client ]  (typed HTTP wrapper)
   |  +-----------------------+   Postgres (Supabase) via Prisma
   |
   | viem.writeContract
   v
[ MarketplaceRegistry @ Sepolia 0x42Fb…09CB ]
       ^
       |
[ plugins/elizaos ]   (agent-facing plugin, dry-run envelopes today)
```

## Repository layout

```
apps/
  web/                  Vite + React + TanStack Router/Query frontend
  api/                  Hono backend with Prisma persistence
packages/
  schema/               Shared Zod schemas (Workflow, Execution, MarketplaceListing, Template)
  templates/            Hardcoded DeFi templates (Aave deposit, Uniswap DCA, Lido stake)
  llm/                  extractWorkflowIntent — Claude Haiku 4.5 + Vercel AI SDK
  keeperhub-client/     KeeperHub HTTP client (deploy/execute/getStatus)
plugins/
  elizaos/              ElizaOS plugin: 5 actions, dry-run only at runtime
contracts/              Foundry project: MarketplaceRegistry, Lido mocks
docs/                   This directory
```

## Core flow — happy path

1. **Compile.** User submits a prompt in `apps/web/workflows/new`.
   `apps/api` calls `extractWorkflowIntent` which sends the full template
   catalog (3 entries) and the prompt to Claude Haiku, gets back
   `{ templateId, parameters, confidence, reasoning }`.

2. **Materialise.** `apps/api/services/compile.ts` fills the chosen template
   with extracted parameters, validates the result against `workflowSchema`,
   and persists it to the `workflows` table as `status: draft`.

3. **Deploy to KeeperHub.** `packages/keeperhub-client` POSTs the workflow to
   `POST /workflows/create` with empty `nodes`/`edges` (KeeperHub auto-fills
   manual trigger + empty action node). The returned `keeperJobId` is stored
   and the workflow flips to `status: deployed`.

4. **Onchain register.** Frontend computes
   `contentHash = keccak256(JSON.stringify(workflow))` and a workflow URI,
   then calls `MarketplaceRegistry.register(contentHash, uri)` via
   `viem.writeContract` from the user's wallet. Listing is created with
   `status: Pending` on-chain.

5. **Persist listing.** Frontend posts to `/api/marketplace` with the workflow
   id, pricing, tags, and the onchain payload (txHash, contentHash, uri). The
   API stores it in `marketplace_listings` with
   `stats.onchain.status: 'pending'`.

6. **Confirm.** Frontend awaits the receipt with
   `publicClient.waitForTransactionReceipt`, decodes the `ListingCreated`
   event for `registryListingId`, and PATCHes the listing — flipping
   `stats.onchain.status` to `'confirmed'` with `registryListingId` and
   `confirmedAt`.

7. **Execute.** From the workflow detail page, "Run now" triggers
   `POST /api/workflows/:id/run` which calls KeeperHub
   `POST /workflow/:id/execute`. The API records the execution
   (`executions` table), increments `runCount`, sets `lastRunAt`, and the UI
   surfaces the new run via 5-10s polling.

## State machines

### Workflow status

```
draft  --[deploy success]-->  deployed  --[pause]-->  paused
                                   |                     |
                                   |                     +--[resume]--> deployed
                                   |
                                   +--[run / scheduled]--> (KeeperHub job runs)
```

KeeperHub has no native pause endpoint, so `paused` is a UI-only flag (see
"intentional limitations" below).

### Marketplace listing onchain status

```
(no onchain field)        offchain only — listing created without a tx
       |
       | publish with txHash
       v
status: 'pending'         tx submitted, receipt not yet observed
       |
       | waitForTransactionReceipt + ListingCreated event decoded
       v
status: 'confirmed'       receipt confirmed, registryListingId stored
```

The on-chain `MarketplaceRegistry` itself has a separate three-state lifecycle
(`Pending` → `Approved` → `Archived`) gated by the curator. "Confirmed" in our
DB means "tx mined and listing on-chain"; the curator then approves listings
to make them discoverable through the contract's approved set.

## Persistence — Postgres + Prisma

| Table | Purpose | Key fields |
|-------|---------|------------|
| `workflows` | Compiled workflow instances | `id, templateId, owner, parameters, trigger, actions, status, keeperJobId, runCount, lastRunAt` |
| `executions` | Run history (one row per Run now) | `id, workflowId, executionId, status, createdAt` |
| `marketplace_listings` | Published workflows | `id, workflow (snapshot), author, tags, pricing, stats (with optional onchain block)` |
| `agents` | Agent catalog | `id, name, description, actions[]` |

DB host: Supabase Postgres (Asia Pacific, Seoul). Pooled URL (port 6543) for
runtime queries, direct URL (port 5432) for `prisma migrate`.

## External integrations

### KeeperHub (live)

- `deployWorkflow(workflow)` → `POST /workflows/create` — creates job and
  returns `keeperJobId`.
- `executeWorkflow(jobId)` → `POST /workflow/:id/execute` — manual trigger.
- `getJobStatus(jobId)` → `GET /workflows/:id` — polled by frontend every 5s.
- `pauseJob` / `resumeJob` are no-ops (KeeperHub has no native pause).
- All errors are wrapped with a `[keeperhub]` prefix so the API error mapper
  can distinguish KeeperHub failures from internal ones (401 →
  `KEEPERHUB_AUTH_FAILED`, 4xx/5xx → `KEEPERHUB_ERROR`).

### Sepolia MarketplaceRegistry (live)

- Address: `0x42Fb9D61dDed6491874225e00F5d9D69612D09CB`
- Source: `contracts/src/MarketplaceRegistry.sol`
- Functions used today: `register(bytes32, string)`. Curator-only
  `approveListing` / `archiveListing` exist but are not yet wired to the UI.
- Frontend uses `wagmi` + `viem` for the write call; `walletClient.writeContract`.
- Receipt parsing decodes the `ListingCreated` event for the registry id.

### ElizaOS (plugin, dry-run only at runtime)

`plugins/elizaos` exposes five actions:

| Action | Behaviour today |
|--------|-----------------|
| `BROWSE_TEMPLATES` | Reads the local template registry — works as advertised |
| `DESCRIBE_TEMPLATE` | Reads one template — works as advertised |
| `CREATE_WORKFLOW` | Builds a dry-run workflow candidate locally, no API/chain call |
| `BROWSE_MARKETPLACE` | Returns dry-run listings synthesised from the local template registry, plus AXL envelope drafts |
| `CREATE_WORKFLOW_DEMO` | Same as `CREATE_WORKFLOW`, explicit demo namespace |

The plugin advertises `executionMode: DRY_RUN_ONLY` and a safety manifest
naming the runtime resources it will not touch (signer, RPC, wallet, app API,
KeeperHub). For each candidate it produces an AXL envelope draft
(`axlEnvelopeDraft.payload.contentHash`, `route.sendEndpoint: '/send'`, etc.)
plus on-chain `register` calldata, so an integrator that adds a signer +
network access can flip the plugin to live without restructuring the action
shape.

### Gensyn AXL (additive, dry-run envelopes)

Workflows ship with an `axlFlow` block (protocol metadata + node API map) and
a canonical-JSON `contentHash`. The plugin does **not** open a connection to
an AXL node today — `blockedBy: ['no-axl-node', 'no-peer-id', 'dry-run-only']`
is set explicitly in the plugin response.

## Templates

Hardcoded TypeScript objects in `packages/templates/src/`. Three today:

- `aave-recurring-deposit` — recurring USDC supply on Aave v3.
- `uniswap-dca` — periodic swap of token A → token B.
- `lido-stake` — periodic ETH → stETH staking.

Templates are code, not DB rows. Adding a new template is a code PR. This is
intentional — DeFi action recipes need security review before they are
exposed to natural-language compilation.

Each template ships Sepolia metadata
(`packages/templates/src/sepolia-metadata.ts`) — chainId, contract addresses,
`runtimePlaceholderValues`, `unsupportedOperations`, and human-confirmation
flags — so the plugin and the API can describe the protocol-level expectations
without hitting the chain.

## Frontend state

- Server cache: TanStack Query, cached by route + filters; 5-10s polling for
  workflow detail (status + executions).
- Marketplace filters/sort/query sync to URL via TanStack Router
  `validateSearch`.
- Local UI state: Zustand stores (`draft-store`, `toast-store`).
- Forms: react-hook-form + zod (`PromptInput`, parameter editor).
- Wallet: `wagmi` v2 + `viem`. Sepolia is the default network.

## LLM

- Model: `claude-haiku-4-5-20251001` (Vercel AI SDK).
- Schema-constrained output via `generateObject` against `intentSchema`.
- Templates are prefiltered by keyword (`candidateTemplates`) but the current
  `extractWorkflowIntent` sends the full catalog to Claude — Haiku handles 3
  entries cheaply. Confidence is calibrated by the system prompt.

## Hosting

- Frontend: Vercel — <https://1ooms-web.vercel.app>
- Backend: Railway — <https://loomlabsapi-production.up.railway.app>.
  Start command is `prisma migrate deploy && tsx src/index.ts`, so every
  deployment auto-applies pending Prisma migrations before the server boots.
- Database: Supabase Postgres (Asia Pacific, Seoul).

## Intentional limitations (be honest in demo)

- **3 templates only.** New protocols require a code PR.
- **ElizaOS plugin is dry-run only.** It exposes the right shape (actions,
  envelopes, register calldata) but does not call the API, KeeperHub, or
  the chain. A live mode is straightforward to add but not in scope today.
- **Curator approval not exposed.** Listings register as `Pending` on-chain
  and our DB flips to `confirmed` once the tx is mined; the curator's
  `approveListing` step is implemented in the contract but not surfaced in
  the UI.
- **KeeperHub pause is store-only.** KeeperHub has no native pause endpoint,
  so a paused workflow keeps running on KeeperHub while the UI shows
  `paused`. Cancelling fully requires deleting the job.
- **Lido on Sepolia uses mocks** (`MockLido`, `MockStETH`, `MockWstETH`)
  because the legacy Sepolia Lido contracts are deprecated. Mainnet uses the
  real contracts.

## Key data shapes

See `packages/schema/`:

- `workflowSchema` — id, templateId, owner, name, parameters, trigger, actions,
  status, `keeperJobId`, `runCount`, `lastRunAt`.
- `executionSchema` — id, workflowId, executionId, status, createdAt.
- `marketplaceListingSchema` — id, embedded workflow snapshot, author, tags,
  pricing (`free` or `x402`), stats (installs, runs, optional onchain block).
- `workflowStatusSchema` — KeeperHub-side live status.
- `templateSchema` — parameter spec, trigger, actions blueprint.
