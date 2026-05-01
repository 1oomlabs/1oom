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
  elizaos/              ElizaOS plugin: 6 actions, dual-mode (dry-run + opt-in live)
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

### ElizaOS plugin — dual-mode (dry-run + opt-in live)

`plugins/elizaos` exposes dry-run actions, opt-in app API backed actions, and
explicit Sepolia live execution:

| Action | Dry-run (default) | Live (opt-in) |
|--------|-------------------|---------------|
| `BROWSE_TEMPLATES` | Reads the local template registry | (same — no live mode) |
| `DESCRIBE_TEMPLATE` | Reads one template | (same — no live mode) |
| `BROWSE_MARKETPLACE` | Synthesises demo listings from the local template registry plus AXL envelope drafts | Calls `GET /api/marketplace` against the configured `LOOM_API_BASE_URL` and returns real listings |
| `CREATE_WORKFLOW` | Builds a dry-run workflow candidate locally | Calls `POST /api/workflows`, deploying through KeeperHub. With `LOOM_ELIZAOS_AUTO_PUBLISH=true`, the resulting workflow is auto-published to `/api/marketplace` |
| `CREATE_WORKFLOW_DEMO` | Same as `CREATE_WORKFLOW` dry-run, explicit demo namespace | n/a |
| `CREATE_WORKFLOW_LIVE` | Returns blocked status if any guard fails | Prepares and broadcasts Sepolia transactions for Aave / Uniswap / Lido using a host-injected signer/reader pair |
| `CHECK_AXL_NODE` / `SEND_AXL_WORKFLOW_DRAFT` / `RECEIVE_AXL_MESSAGES` / `EXECUTE_RECEIVED_AXL_WORKFLOW` | Not part of default workflow actions | Opt-in AXL node actions, separate from default dry-run actions |

The plugin advertises `executionMode: DRY_RUN_ONLY` and a safety manifest
naming the runtime resources default actions will not touch (signer, RPC,
wallet, app API, KeeperHub). For each candidate it produces an AXL envelope draft
(`axlEnvelopeDraft.payload.contentHash`, `route.sendEndpoint: '/send'`, etc.)
plus on-chain `register` calldata, so an integrator that adds a signer +
network access can flip the plugin to live without restructuring the action
shape.

#### Mode selection gates

Three layered gates control when each surface goes live:

1. **API mode** — `LOOM_API_BASE_URL` env points at our Railway API. Without
   it, `BROWSE_MARKETPLACE` and `CREATE_WORKFLOW` stay in dry-run regardless
   of the requested mode.
2. **Chain mode** — `LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=true` is required
   for `CREATE_WORKFLOW_LIVE` to even be considered.
3. **Per-call confirmation** — every live-execution call must pass
   `confirmLiveExecution: true` in its options. Without it, the action
   returns a `LIVE_CONFIRMATION_REQUIRED` block.

#### `CREATE_WORKFLOW_LIVE` safety manifest

The live execution path
(`plugins/elizaos/src/live-execution.ts`) hard-codes the following invariants:

- **Sepolia only.** `chainId !== 11155111` returns `UNSUPPORTED_CHAIN`. No
  mainnet path exists.
- **Host-injected adapters.** The plugin never holds a private key. The host
  passes a `signer` (`sendTransaction`) and a `reader`
  (`readContract` / `waitForReceipt` / `getNativeBalance`) and the plugin
  encodes calldata via `viem.encodeFunctionData`.
- **Metadata gate.** `hasConfirmedMetadata(...)` requires every contract
  address and ABI fragment in `packages/templates/src/sepolia-metadata.ts`
  to be `HUMAN_CONFIRMED`. Unconfirmed metadata returns
  `UNCONFIRMED_METADATA`.
- **Slippage policy.** Uniswap requires a non-zero `amountOutMinimum`. A
  zero value returns `SLIPPAGE_POLICY_VIOLATION` before any signer call.
- **Preflight checks.** Every plan reads ERC20 / native balance and
  allowance before returning a transaction list. `INSUFFICIENT_BALANCE` is
  returned ahead of any broadcast.
- **Per-step error mapping.** Failures fall into one of 13 typed error
  codes (`MISSING_SIGNER`, `MISSING_READER`, `INVALID_PARAMETERS`,
  `TRANSACTION_REVERTED`, `POST_CHECK_FAILED`, …). The agent never gets
  raw exceptions.
- **Post-checks.** Each template ends with a sanity `readContract` call
  (e.g. `aTokenBalance`, `tokenOutBalance`, `wstETHBalance`) so the agent
  can verify the on-chain effect.

Three live templates are wired:

| Template | Live plan |
|----------|-----------|
| `aave-recurring-deposit` | (optional) `ERC20.approve` → `AavePool.supply` → check `aToken.balanceOf` |
| `uniswap-dca` | (optional) `ERC20.approve` → `UniswapRouter.exactInputSingle` (slippage gated) → check `tokenOut.balanceOf` |
| `lido-stake` | `MockLido.submit` (with native ETH value) → (optional) `MockStETH.approve` → `MockWstETH.wrap` → check `wstETH.balanceOf` |

### Gensyn AXL — three layers (drafts, client, live demo)

The AXL surface is built in three layers, from safe to live:

1. **Envelope drafts (`plugins/elizaos/src/axl-flow.ts`).** Pure functions
   that produce a `loomlabs.axl.v1` envelope: `axlFlow` protocol metadata,
   a canonical-JSON `contentHash`, route hints (`/send` / `/recv` / peer
   id), and on-chain `register` calldata. No network. Always available, no
   configuration required.
2. **HTTP client (`plugins/elizaos/src/axl-client.ts`).** A minimal
   `AxlClient` that hits the AXL node's HTTP bridge directly: `getTopology`,
   `sendEnvelope`, `receiveMessage`, and `executeReceivedWorkflow` (which
   verifies the envelope's content hash before forwarding to the Loom API).
   Configured by `AXL_NODE_URL`, `AXL_DESTINATION_PEER_ID`, `LOOM_API_URL`,
   `LOOM_WORKFLOW_OWNER`, `ENABLE_AXL_AGENT_EXECUTION`.
3. **Two-node demo (`examples/axl-agents`).** Standalone publisher and
   receiver scripts that talk to two real `gensyn-ai/axl` binaries with
   different identities and `api_port`s. Used to satisfy the Gensyn track
   qualification — see `examples/axl-agents/README.md`.

The MCP/A2A dry-run projection (`plugins/elizaos/src/axl-dry-run.ts`) sits
on top of layer 1 and is rendered as `mcpToolRegistry` / `a2aAgentCard`
objects in plugin responses. It maps the same workflow API steps to MCP
tool listings and A2A skills, including the JSON-RPC bodies a real AXL
node would expect on `/mcp/{peer_id}/{service}` and `/a2a/{peer_id}`.

ElizaOS plugin actions wired to layer 2:

| Action | Behaviour |
|--------|-----------|
| `CHECK_AXL_NODE` | Calls `GET /topology` on the configured node, returns the public key + connected peers. Useful as a precheck before send/recv. |
| `SEND_AXL_WORKFLOW_DRAFT` | Builds an envelope from an inbound message and posts it to `/send` with `X-Destination-Peer-Id`. Returns `X-Sent-Bytes`. |
| `RECEIVE_AXL_MESSAGES` | Polls `/recv` once. Returns null on 204, parsed envelope plus `from_peer_id` on 200. |
| `EXECUTE_RECEIVED_AXL_WORKFLOW` | Receives, recomputes the content hash via `verifyAxlEnvelopeDraft`, and hands the workflow off to `POST /api/workflows`. Gated by `ENABLE_AXL_AGENT_EXECUTION=true`. |

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
- **ElizaOS live execution is opt-in, not the default.** Three explicit
  gates (`LOOM_API_BASE_URL`, `LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION`, and
  per-call `confirmLiveExecution: true`) must all be set before the plugin
  touches anything off-host. Without them every action stays in dry-run.
  This is intentional: judging is reproducible without keys or RPC, while
  an integrator with a wallet can promote the same plugin to live without
  code changes.
- **AXL is an opt-in side channel.** The default web flow stores listings
  in Postgres and anchors them on Sepolia; AXL routing is only used when
  the operator runs the [`examples/axl-agents`](../examples/axl-agents)
  publisher/receiver pair (or invokes the plugin's AXL actions). This
  keeps the system usable without an AXL node while still satisfying the
  Gensyn track's "communication across separate AXL nodes" requirement.
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
