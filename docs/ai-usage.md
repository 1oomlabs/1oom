# AI usage disclosure

> ETHGlobal requires teams to disclose how AI tooling was used during the hackathon.
> Keep this file updated as development progresses.

## Tools used

- Claude (Anthropic) - project planning, architecture discussion, code scaffolding.
- GitHub Copilot / Cursor - autocomplete and small refactors (add as applicable).

## Where AI contributed

- Initial monorepo scaffold (this directory layout, config files, package.json manifests).
- Draft of the natural-language -> template intent extraction prompt.
- Template specification schema and example templates.

## Where humans drove

- Product scope, focus-area positioning, and final template selection.
- DeFi contract interface choices (Aave v3, Uniswap v3, Lido) and testnet validation.
- All smart-contract logic in `contracts/`.
- Final copy for demo, docs, and submission.

## Policy

- AI-generated code is reviewed by a human before merge.
- API keys, private keys, and user data never leave the local environment.
