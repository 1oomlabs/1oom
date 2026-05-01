# AI usage disclosure

> ETHGlobal requires teams to disclose how AI tooling was used during the
> hackathon. This file lists every AI surface in the project — both as a
> product runtime dependency and as a development tool — and the boundaries
> we set around each.

## Product-runtime AI

| Surface | Model | Where it runs | What it does |
|---------|-------|---------------|--------------|
| `extractWorkflowIntent` | `claude-haiku-4-5-20251001` | `apps/api` server-side via Anthropic API | Maps a natural-language prompt to `{ templateId, parameters, confidence, reasoning }` against a 3-template catalog, schema-constrained by Zod (`intentSchema`) |
| `POST /api/llm/extract` | same | `apps/api` | Thin debug endpoint that exposes intent extraction without the rest of the workflow lifecycle |
| `POST /api/agents/:id/intent` | same | `apps/api` | Agent-shaped façade over the same call, used by the ElizaOS plugin |

**Boundaries**:

- All product calls go through `packages/llm` (one definition).
- Output is constrained to `intentSchema` via Vercel AI SDK's
  `generateObject`. The model cannot return free-form text into the
  workflow pipeline.
- The Anthropic API key is server-side only (`ANTHROPIC_API_KEY` in
  Railway env). It is never sent to the browser.
- No user prompt or wallet address is logged outside the API process.

## Development-time AI

These tools were used during the hackathon to help write code, docs, and
review surfaces. None of them runs at product runtime.

- **Claude Code (Anthropic)** — primary pair-programming surface for
  scaffolding, refactors, and code review. Used heavily for the
  monorepo skeleton, View-Model hook pattern across the frontend, the
  Resource/Hook abstractions in `apps/web/src/api/`, and successive
  rounds of code review.
- **Cursor / VS Code Copilot** — autocomplete and inline edits during
  individual development sessions.
- **GitHub PR review (manual)** — every AI-assisted change merged through
  a human-reviewed PR. PR list is public on
  <https://github.com/1oomlabs/1oom/pulls>.

## Where AI contributed

- Initial monorepo scaffold (workspace layout, turbo + pnpm config,
  shared `tsconfig.base`).
- Frontend View-Model hook pattern and the `Resource<T>` /
  `makeResourceHooks` abstraction in `apps/web/src/api/`.
- Refactor of marketplace state to URL-synchronised query params via
  TanStack Router `validateSearch`.
- Backend persistence migration from in-memory Map to Postgres via
  Prisma, including idempotent migration generation and the seed script.
- ElizaOS plugin shape — action types, dual-mode (dry-run + opt-in live)
  routing, AXL envelope draft helpers, and the `live-execution.ts`
  Sepolia-only plan/preflight/error-mapping module that prepares Aave,
  Uniswap, and Lido transactions through host-injected adapters.
- Schema design for `executions`, the `runCount`/`lastRunAt` denormalised
  columns, and the `recordRun` Prisma transaction.
- Iterative prompt engineering for `extractWorkflowIntent` — including
  confidence calibration rules and protocol disambiguation hints.
- Documentation drafting (this file, `architecture.md`, `approach.md`,
  per-package READMEs).

## Where humans drove

- Product scope, focus-area positioning, and the "3 vetted templates +
  marketplace remix" boundary.
- DeFi contract interface choices: Aave v3, Uniswap v3 SwapRouter, Lido
  Sepolia mocks. Choosing to ship Lido mocks because the legacy Sepolia
  contracts are deprecated.
- Smart contract logic in `contracts/` — the `MarketplaceRegistry`
  three-state lifecycle, curator gating, content-hash uniqueness invariant,
  approved-listings index. Foundry tests
  (`MarketplaceRegistry.t.sol`, `MockLido.t.sol`, `Deploy.t.sol`).
- Sepolia deployment to `0x42Fb9D61dDed6491874225e00F5d9D69612D09CB`,
  including faucet provisioning, RPC selection, and verification.
- KeeperHub integration choices — the empty-`nodes`/`edges` deploy quirk,
  the response-shape fallback (`{data:{...}}` vs bare object), the decision
  to make pause/resume store-only because KeeperHub has no native primitive.
- Hosting decisions: Vercel for the frontend, Railway for the API,
  Supabase for the DB. The `nixpacks.toml` config that lets Railway build
  a pnpm monorepo and the `prisma migrate deploy` start hook.
- Final copy for demo, README, approach doc, and submission.
- All credential handling (Anthropic, KeeperHub, Supabase, deployer EOA).

## Policy

- **Reviewed before merge.** Every AI-assisted change goes through a human
  PR review. No direct commits to `main`. Branch policy and PR template
  documented in the root README.
- **Secrets stay out.** Anthropic / KeeperHub / Supabase credentials live
  only in `.env` (gitignored) for local dev and in Railway / Vercel env
  variables for production. The frontend never sees server-side keys.
- **Schema-bounded LLM output.** The model's output enters the system
  through `intentSchema`. Anything that fails the schema is rejected at the
  API boundary, not silently coerced.
- **No autonomous execution.** AI can extract intent and propose a
  workflow; a human (or a wallet under the user's control) must sign the
  on-chain transactions. No private key is ever held by an AI surface.
