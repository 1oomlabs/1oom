# loomlabs

Natural language to DeFi workflow automation with an agent marketplace, anchored
onchain via a Sepolia `MarketplaceRegistry`.

Built for ETHGlobal. Primary submission is the **KeeperHub** track. The
ElizaOS plugin and the Sepolia `MarketplaceRegistry` ship as part of the
system but are not separate prize tracks; we considered Gensyn AXL but did
not pursue eligibility (see [`docs/approach.md`](./docs/approach.md)).

For the submission narrative see [`docs/approach.md`](./docs/approach.md). For
the full system breakdown see [`docs/architecture.md`](./docs/architecture.md).
For AI usage disclosure see [`docs/ai-usage.md`](./docs/ai-usage.md).

## Live deployments

| Surface | Where |
|---------|-------|
| Frontend | <https://1ooms-web.vercel.app> (Vercel) |
| API | <https://loomlabsapi-production.up.railway.app> (Railway) |
| `MarketplaceRegistry` | [`0x42Fb9D61dDed6491874225e00F5d9D69612D09CB`](https://sepolia.etherscan.io/address/0x42Fb9D61dDed6491874225e00F5d9D69612D09CB) on Sepolia |
| Database | Supabase Postgres (Asia Pacific, Seoul) |

## Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm workspace + turborepo |
| Frontend | Vite 6 + React 18 + TypeScript 5.7 + TanStack Router/Query 5 + Zustand 5 |
| UI system | shadcn/ui + Radix + Tailwind 3.4 + Pretendard |
| Wallet | wagmi v2 + viem |
| Backend | Hono + Zod + Vercel AI SDK + Anthropic Claude Haiku 4.5 |
| Persistence | Postgres (Supabase) + Prisma 6 |
| Contracts | Foundry + Solidity 0.8.24 |
| Agent | `@elizaos/core` v2 alpha plugin (dual-mode: dry-run + opt-in live Sepolia execution) |
| Tooling | Biome, Vitest, TypeScript |

## Structure

```
apps/
  web/              Frontend (Vite + React + TanStack)
  api/              Backend (Hono + Prisma)
packages/
  schema/           Shared Zod schemas (Workflow, Execution, MarketplaceListing, Template)
  templates/        Hardcoded DeFi templates (Aave deposit, Uniswap DCA, Lido stake)
  keeperhub-client/ Typed HTTP client for KeeperHub
  llm/              Natural language → intent (Claude Haiku 4.5)
plugins/
  elizaos/          ElizaOS plugin: 6 actions, dual-mode (dry-run + opt-in live)
contracts/          Foundry project: MarketplaceRegistry + Lido mocks
docs/               architecture / approach / ai-usage / api-hooks / design-system
examples/
  demo-scenarios/   End-to-end demo scripts
```

## Getting started

```bash
nvm use         # Node 20.18.1
cp apps/api/.env.example apps/api/.env   # fill DATABASE_URL / DIRECT_URL / ANTHROPIC_API_KEY
cp apps/web/.env.example apps/web/.env   # if not present
pnpm setup      # install + apply migrations + seed (run once)
pnpm dev        # apply pending migrations, then start web + api in parallel
```

## Scripts

- `pnpm setup` - install deps, run migrations, seed DB (one-shot)
- `pnpm dev` - apply pending migrations then run all dev servers
- `pnpm dev:fast` - skip migrate, run dev servers only (when DB is unchanged)
- `pnpm db:deploy` - apply pending migrations to the configured DB
- `pnpm db:migrate` - create + apply a new migration (schema changes)
- `pnpm db:seed` - run the seed script
- `pnpm db:studio` - open Prisma Studio
- `pnpm db:reset` - drop + reapply migrations + seed (destructive)
- `pnpm build` - build all packages
- `pnpm typecheck` - typecheck all packages
- `pnpm lint` - biome check
- `pnpm lint:fix` - biome check + autofix
- `pnpm test` - vitest across packages

## Development workflow

### Branch model

```
main                   stable / demo-ready. Only receives merges from dev.
  └── dev              integration branch. All feature branches merge here.
        └── feature/*  individual work. Branch from dev, PR back to dev.
```

- **Never push directly to `main` or `dev`.** Open a PR.
- **`main`** is tagged for the ETHGlobal submission and demo video. Treat it
  as release-only.
- **`dev`** is the living branch the team works off. Daily pulls expected.
- **`feature/*`** branches are short-lived (target: <2 days). If a feature
  grows bigger, split it.

### Branch naming

```
feature/<scope>-<short-description>

examples:
  feature/web-workflow-builder-ui
  feature/api-keeperhub-deploy
  feature/templates-aave-recurring-deposit
  feature/contracts-marketplace-registry
fix/<scope>-<what>
  fix/api-cors-origin
chore/<what>
  chore/bump-vite
```

### Typical cycle

```bash
git checkout dev && git pull
git checkout -b feature/web-workflow-builder-ui

# ... work ...
pnpm lint && pnpm typecheck     # must pass before PR

git push -u origin feature/web-workflow-builder-ui
gh pr create --base dev         # PR targets dev, NOT main
```

### PR rules

- **Target branch**: `dev` for feature/fix/chore. Only release PRs target `main`.
- **Required before merge**: `pnpm lint` + `pnpm typecheck` green. Reviewer OK.
- **Merge strategy**: squash merge into `dev`. Keep `dev` history clean.
- **Release to `main`**: open a single PR `dev -> main` when cutting a demo build.

### Commit messages

Keep them short and imperative. Scope prefix optional but helpful:

```
web: add natural-language prompt input
api: wire keeperhub deploy endpoint
templates: add uniswap DCA
contracts: MarketplaceRegistry skeleton
docs: update architecture diagram
```
