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

- **Plugin shape that is ready for an agent runtime.** The ElizaOS plugin
  declares an explicit safety manifest (which runtime resources are off-limits
  and why) and ships AXL envelope drafts plus on-chain `register` calldata
  for every candidate workflow. Today it operates in dry-run mode; an
  integrator that supplies a signer and an `LOOMLABS_API_URL` can promote
  it to live without restructuring the action surface.

- **Honest LLM contract.** `extractWorkflowIntent` constrains the model to
  `intentSchema` and is used in two places: the prompt → workflow path on
  the frontend and the agent action surface in the plugin. There is exactly
  one definition of "what counts as a valid intent."

## Track alignment

We target the **KeeperHub** track as our primary submission.

| Track | Where this hits the brief |
|-------|---------------------------|
| **KeeperHub** (primary) | `packages/keeperhub-client` is a typed HTTP wrapper around the full lifecycle (deploy, execute, status). The API records every execution in a dedicated `executions` table and surfaces live job status to the UI on a 5s tick; pause/resume are wired with explicit "store-only" semantics where KeeperHub has no native primitive. Empty-`nodes`/`edges` deploy quirk handled (see client comments). The frontend detail page shows runCount, lastRunAt, recent run history, and live KeeperHub job status side by side. |

### Beyond the track — agent surface and onchain anchoring

These pieces ship as part of the loomlabs system but are not standalone track
submissions:

- **ElizaOS plugin.** `plugins/elizaos` exposes 5 actions against
  `@elizaos/core` v2 alpha types. The plugin imports the same templates and
  schemas the rest of the stack uses, so anything an agent describes is the
  same shape the API and the contract see. ElizaOS is the runtime we chose
  for the agent-facing surface; it is not a separate prize track for this
  hackathon.

- **Sepolia `MarketplaceRegistry`.** Deployed to
  [`0x42Fb…09CB`](https://sepolia.etherscan.io/address/0x42Fb9D61dDed6491874225e00F5d9D69612D09CB).
  Listings carry their content hash, tx hash, and on-chain `registryListingId`
  end-to-end. The frontend signs `register(...)` from the user's wallet and
  the marketplace UI shows a "Verified on Sepolia" badge once the receipt
  confirms.

### Not pursued: Gensyn AXL prize

We considered the Gensyn AXL track but **do not claim eligibility**. The track
qualification requires (a) using AXL for inter-agent communication and (b)
demonstrating communication across separate AXL nodes. Our plugin produces
AXL `publish` / `discover` envelope *drafts* — correct shape, content hash,
register calldata — but does not run an AXL node or call `/send` / `/recv`.
Wiring this up is straightforward future work (the envelope shape is already
locked in `plugins/elizaos/src/axl-flow.ts`), but it is not part of this
submission.

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

- The ElizaOS plugin is dry-run only. The shape is production-ready;
  the runtime is not. (Roadmap: gate `LOOMLABS_API_URL` env var to enable
  the live read path.)
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
