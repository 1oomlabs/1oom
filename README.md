# loomlabs

Natural language to DeFi workflow automation with an agent marketplace.

Built for ETHGlobal hackathon. Targets KeeperHub, ElizaOS, and Gensyn AXL tracks.

## Stack

- pnpm workspace + turborepo
- Vite + React + TanStack Router/Query + Zustand
- shadcn/ui + Tailwind
- Hono + Vercel AI SDK (Anthropic)
- wagmi + viem
- Foundry (AXL contracts)
- Biome, Vitest, TypeScript

## Structure

```
apps/
  web/              Frontend (Vite + React)
  api/              Backend (Hono)
packages/
  schema/           Shared Zod schemas (workflow, template, marketplace)
  templates/        DeFi automation templates (Aave, Uniswap, Lido)
  keeperhub-client/ KeeperHub API wrapper
  llm/              Natural language -> parameter extraction
plugins/
  elizaos/          ElizaOS plugin exposing the marketplace to agents
contracts/          Foundry project (AXL registry, x402 payment)
docs/               Architecture, approach, AI usage
examples/
  demo-scenarios/   End-to-end demo scripts
```

## Getting started

```bash
nvm use         # Node 20.18.1
pnpm install
pnpm dev        # runs web + api in parallel
```

## Scripts

- `pnpm dev` - start all dev servers
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
