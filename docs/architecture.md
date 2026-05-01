# Architecture

## One-line

Natural language -> DeFi workflow -> KeeperHub execution, plus an agent
marketplace where agents publish and consume workflows.

## Components

```
[User / Agent]
     |
     v  natural language
[apps/web]  ---REST--->  [apps/api]
                              |
                              +--> [packages/llm]          (intent + parameter extraction, Claude)
                              +--> [packages/templates]    (5 DeFi templates)
                              +--> [packages/keeperhub-client] (deploy to KeeperHub)
                              +--> [plugins/elizaos]       (agent-facing surface)
                              +--> [contracts]             (AXL registry, x402)
```

## Core flow

1. User (or agent) submits a natural-language prompt: "Every Monday, DCA 100 USDC
   into ETH on Uniswap".
2. `packages/llm.extractWorkflowIntent` prefilters candidate templates via keyword
   match, then calls Claude with the candidate catalog and the user prompt to
   produce `{ templateId, parameters, confidence }`.
3. `apps/api` fills the chosen template with the extracted parameters, producing
   a `Workflow` (see `packages/schema/workflow`).
4. `packages/keeperhub-client` deploys the workflow to KeeperHub.
5. Optionally the workflow is published to the marketplace (`MarketplaceRegistry`
   contract + API listing).
6. Other agents discover listings via `plugins/elizaos.BROWSE_MARKETPLACE` and
   reuse or remix them.
7. The additive AXL phase exposes dry-run publish/discover envelopes, and the
   enhance phase adds opt-in AXL node actions for `/topology`, `/send`, and
   `/recv` plus a guarded API execution handoff.
8. MCP/A2A dry-run projection keeps the existing API-step workflow model intact:
   MCP treats workflow API steps as tool previews, while A2A treats the full
   workflow as an agent/skill request preview. No AXL node call is made in this
   dry-run path.

## Key data shapes

See `packages/schema`:

- `Template` - parameterised blueprint of an automation.
- `Workflow` - concrete, deployed instance of a template.
- `MarketplaceListing` - a published workflow + author + pricing.

## Sepolia marketplace

`MarketplaceRegistry` is deployed on Sepolia at:

```txt
0x42Fb9D61dDed6491874225e00F5d9D69612D09CB
```

Agent execution remains opt-in: AXL receive -> content hash verification ->
`apps/api` workflow creation only runs when `ENABLE_AXL_AGENT_EXECUTION=true`.
