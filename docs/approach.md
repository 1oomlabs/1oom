# Approach

> ETHGlobal submission document. ~2 pages. Companion to
> [`architecture.md`](./architecture.md) and [`ai-usage.md`](./ai-usage.md).

## Problem

Running a DeFi automation today still demands writing a bespoke keeper script,
hand-rolling each protocol's contract calls, and standing up a service to
schedule and monitor it. The cost of "deposit 100 USDC into Aave every Friday"
is a weekend of plumbing for a human and a stack of brittle prompts for an
agent. The composition story between agents — A creates an automation, B
discovers and remixes it — has no plumbing at all: there is no shared
substrate where automations live as durable, addressable objects.

## Solution

**loomlabs** is a thin compiler stack that turns natural language into a
typed, KeeperHub-executed, onchain-anchored DeFi workflow.

1. **Compile.** A natural-language prompt becomes
   `{ templateId, parameters }` via Claude Haiku 4.5 with schema-constrained
   output (Vercel AI SDK + Zod). Three vetted templates today: Aave recurring
   deposit, Uniswap DCA, Lido stake.
2. **Materialise.** The chosen template + extracted parameters are validated
   against `workflowSchema`, persisted in Postgres, and deployed to KeeperHub
   for scheduled or on-demand execution.
3. **Anchor.** The workflow's canonical hash and URI are registered onchain
   in `MarketplaceRegistry` on Sepolia. Other agents can discover it
   trustlessly without a central coordinator.
4. **Track.** Every run is recorded in an `executions` table with KeeperHub's
   live status polled into the UI on a 5-10s tick.

## Why this is more than glue

- **One schema, four runtimes.** `packages/schema` (Zod) is imported by the
  Vite frontend, the Hono backend, the ElizaOS plugin, and the LLM intent
  extractor. The `Workflow`, `Execution`, and `MarketplaceListing` types are
  the same object on every layer — no DTO drift.

- **End-to-end onchain wiring.** Publishing a workflow does the full dance:
  `walletClient.writeContract` → tx hash → API publish (status `pending`) →
  `waitForTransactionReceipt` → `decodeEventLog(ListingCreated)` → API patch
  to `confirmed` with the on-chain `registryListingId`. The marketplace card
  and detail page surface this state with deep Etherscan links.

- **Run history with KeeperHub depth.** "Run now" calls KeeperHub's
  `executeWorkflow`, persists an `Execution` row in the same Postgres
  transaction that bumps `runCount` / `lastRunAt`, and the detail page
  polls KeeperHub's live job status alongside our local execution log. Pause
  / resume / fork are wired against the same client.

- **Dual-mode ElizaOS plugin with opt-in live execution.** The plugin runs
  in dry-run by default but flips to a live mode under three explicit gates:
  `LOOM_API_BASE_URL` for read/write through our API,
  `LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION` for direct on-chain transactions, and
  a per-call `confirmLiveExecution: true`. In live mode the plugin uses a
  host-injected signer/reader adapter (no private keys held by the plugin),
  encodes calldata with `viem.encodeFunctionData`, runs preflight balance and
  allowance checks, enforces a non-zero Uniswap `amountOutMinimum`, and
  rejects anything outside Sepolia (chainId 11155111). All thirteen failure
  paths surface as typed error codes (`MISSING_SIGNER`, `INSUFFICIENT_BALANCE`,
  `SLIPPAGE_POLICY_VIOLATION`, …) so an agent can react safely.

- **Honest LLM contract.** `extractWorkflowIntent` constrains the model to
  `intentSchema` and is used in two places: the prompt → workflow path on
  the frontend and the agent action surface in the plugin. There is exactly
  one definition of "what counts as a valid intent."

- **Agent-to-agent over Gensyn AXL — actually wired.** Two `gensyn-ai/axl`
  binaries run side by side; one agent posts a workflow envelope to its
  local AXL node via `POST /send`, the AXL mesh routes the bytes to the
  other node, and a second agent polls `GET /recv`, verifies the SHA-256
  content hash, and (with `ENABLE_AXL_AGENT_EXECUTION=true`) hands the
  workflow off to the Loom API for deployment through KeeperHub. With
  `LOOM_AUTO_PUBLISH_TO_MARKETPLACE=true` the receiver also publishes
  the deployed workflow with the tags `axl-agent` and `received-via-mesh`,
  so AXL-discovered listings show up on the production marketplace next
  to web-published ones — the marketplace card carries a vermilion
  "via AXL agent" badge to make the source visible. The plugin's
  `AxlClient` drives the same path from inside ElizaOS. End-to-end demo
  lives in [`examples/axl-agents`](../examples/axl-agents).

## Track alignment

We target two tracks: **KeeperHub** as the primary submission, and **Gensyn
(Best Application of AXL)** as a parallel submission backed by a working
two-node demo in [`examples/axl-agents`](../examples/axl-agents).

| Track | Where this hits the brief |
|-------|---------------------------|
| **KeeperHub** | `packages/keeperhub-client` is a typed HTTP wrapper around the full lifecycle (deploy, execute, status). The API records every execution in a dedicated `executions` table and surfaces live job status to the UI on a 5s tick; pause/resume are wired with explicit "store-only" semantics where KeeperHub has no native primitive. Empty-`nodes`/`edges` deploy quirk handled (see client comments). The frontend detail page shows runCount, lastRunAt, recent run history, and live KeeperHub job status side by side. |
| **Gensyn (AXL)** | Two `gensyn-ai/axl` binaries run side by side; the publisher posts a `loomlabs.axl.v1` workflow envelope with a SHA-256 content hash and `X-Destination-Peer-Id`, the receiver polls `/recv`, decodes the envelope, and (with `ENABLE_AXL_AGENT_EXECUTION=true`) forwards it to the Loom API to deploy through KeeperHub. With `LOOM_AUTO_PUBLISH_TO_MARKETPLACE=true` the receiver also creates a marketplace listing tagged `axl-agent` — the production marketplace card surfaces this with a "via AXL agent" badge. Both nodes have separate ed25519 identities, separate IPv6 addresses, and separate `api_port` values — communication is genuinely across nodes, not in-process. The plugin's [`AxlClient`](../plugins/elizaos/src/axl-client.ts) drives the same flow from inside ElizaOS via four semi-live actions. |

### Beyond the track — agent surface and onchain anchoring

These pieces ship as part of the loomlabs system but are not standalone track
submissions:

- **ElizaOS plugin.** `plugins/elizaos` exposes 6 actions against
  `@elizaos/core` v2 alpha types. The plugin imports the same templates and
  schemas the rest of the stack uses, so anything an agent describes is the
  same shape the API and the contract see. It runs dual-mode: dry-run by
  default for safe local demos, plus opt-in live read/write through our
  Railway API (`BROWSE_MARKETPLACE`, `CREATE_WORKFLOW` live paths) and
  opt-in direct Sepolia transactions through `CREATE_WORKFLOW_LIVE` for
  Aave, Uniswap, and Lido. ElizaOS is the runtime we chose for the
  agent-facing surface; it is not a separate prize track for this hackathon.

- **Sepolia `MarketplaceRegistry`.** Deployed to
  [`0x42Fb…09CB`](https://sepolia.etherscan.io/address/0x42Fb9D61dDed6491874225e00F5d9D69612D09CB).
  Listings carry their content hash, tx hash, and on-chain `registryListingId`
  end-to-end. The frontend signs `register(...)` from the user's wallet and
  the marketplace UI shows a "Verified on Sepolia" badge once the receipt
  confirms.

### Gensyn track (Best Application of AXL) — also pursued

We meet both qualification gates:

1. **Use AXL for inter-agent communication, no central broker replacing
   what AXL provides.** The publisher script in
   [`examples/axl-agents/publisher.ts`](../examples/axl-agents) builds a
   `loomlabs.axl.v1` workflow envelope, computes a SHA-256 content hash,
   and posts it to its local AXL node via `POST /send` with an
   `X-Destination-Peer-Id` header. The receiver in
   [`examples/axl-agents/receiver.ts`](../examples/axl-agents) polls
   `GET /recv` on its own AXL node, decodes the envelope, and (optionally)
   forwards it to the Loom API to actually deploy the workflow. Nothing in
   that path replaces AXL — the loomlabs marketplace is one of two
   discovery surfaces, not the message bus between agents.
2. **Communication across separate AXL nodes, not just in-process.** The
   demo runs two `gensyn-ai/axl` binaries with different ed25519
   identities, different IPv6 addresses, and different `api_port` values.
   The publisher hits Node A on `:9002`; the receiver polls Node B on
   `:9012`. The yggdrasil mesh routes the bytes between them.

The plugin reflects this with semi-live AXL actions backed by
[`plugins/elizaos/src/axl-client.ts`](../plugins/elizaos/src/axl-client.ts):
`CHECK_AXL_NODE`, `SEND_AXL_WORKFLOW_DRAFT`, `RECEIVE_AXL_MESSAGES`, and
`EXECUTE_RECEIVED_AXL_WORKFLOW`. Each call to `executeReceivedWorkflow`
verifies the envelope's content hash against a stable canonical JSON before
deploying — agents do not blindly trust whatever the mesh hands them.

## Demo flow (live)

1. Open <https://1ooms-web.vercel.app/workflows/new> (frontend talks to
   <https://loomlabsapi-production.up.railway.app>).
2. Type *"Stake 1 ETH on Lido every Monday"*. Compile — preview shows the
   matched template + parameters with a confidence badge.
3. Connect a Sepolia wallet. Click **Deploy & publish**.
   - KeeperHub job is created.
   - MetaMask prompts to sign `MarketplaceRegistry.register(...)`.
   - Toast: "Onchain listing submitted 0xabc…".
4. Land on the workflow detail page. The **Onchain** sidebar shows the tx
   link to Sepolia Etherscan. After ~12-30s, status flips to
   **Verified on Sepolia** with the registry id and confirmation timestamp.
5. Click **Run now**. The Recent runs list gets a new row, the **Runs**
   stat tile increments, and the Keeper job hint surfaces the live KeeperHub
   status (polled every 5s).
6. Open `/marketplace`. The same listing appears with a **Verified on
   Sepolia** badge.

## Intentional limitations

We chose to be explicit about what is *not* live so the demo is honest:

- The ElizaOS plugin's live mode is **opt-in, not the default**. Three
  layered gates (`LOOM_API_BASE_URL`, `LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION`,
  per-call `confirmLiveExecution: true`) keep dry-run as the safe path so
  judges can reproduce the plugin without keys or RPC. The same plugin
  promotes to live with no code changes.
- AXL integration runs as an **opt-in side channel**, not a replacement
  for the marketplace API. With `examples/axl-agents` we demonstrate two
  AXL nodes exchanging real envelopes (and the receiver can deploy the
  resulting workflow through Loom API), but the default web flow still
  goes through Sepolia + Postgres for compatibility with non-AXL users.
- Curator-side approval (`approveListing` on the contract) is implemented
  in Solidity but not exposed in the UI. The on-chain "Approved" state is
  one curator transaction away.
- Three templates only — by design. Adding a new DeFi action requires a
  code PR so it can be reviewed before it can be summoned by a prompt.

## Links

- Live frontend: <https://1ooms-web.vercel.app>
- Live API: <https://loomlabsapi-production.up.railway.app>
- Sepolia `MarketplaceRegistry`: [`0x42Fb9D61dDed6491874225e00F5d9D69612D09CB`](https://sepolia.etherscan.io/address/0x42Fb9D61dDed6491874225e00F5d9D69612D09CB)
- Code: <https://github.com/1oomlabs/1oom>
- Architecture: [`docs/architecture.md`](./architecture.md)
- AI usage disclosure: [`docs/ai-usage.md`](./ai-usage.md)
