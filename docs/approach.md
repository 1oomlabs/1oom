# Approach

> ETHGlobal submission document. Keep to ~1-2 pages.

## Problem

Creating and running DeFi automations today requires writing custom keeper scripts,
understanding each protocol's contract interface, and deploying & monitoring a
dedicated service. This is out of reach for most users and is repetitive work for
agents.

## Solution

loomlabs turns natural-language requests into fully parameterised, KeeperHub-executed
workflows, and exposes them through an agent-facing marketplace so workflows can be
shared and remixed.

## Why this is more than glue

- **Depth of KeeperHub integration**: we do not just call the API. We model the
  full lifecycle (intent -> template -> parameterised workflow -> keeper job ->
  marketplace listing) and share one schema across frontend, backend, plugin, and
  contracts.
- **Agent <-> agent composition**: the ElizaOS plugin lets agents both *create*
  and *consume* workflows, turning KeeperHub into a substrate for inter-agent
  cooperation. The AXL-aligned `MarketplaceRegistry` contract anchors this
  without a central coordinator.
- **Natural-language as first-class input**: prompts compile to typed intents
  (`@loomlabs/llm`) with Zod-validated parameters, not free-form strings.

## Track alignment

- **Focus Area 1 - Innovative use**: natural-language -> workflow compilation.
- **Focus Area 2 - Integration**: ElizaOS plugin + x402 pricing on marketplace
  listings.
- **KeeperHub depth**: dedicated `keeperhub-client` wrapping the full job
  lifecycle, not just one endpoint.
- **Gensyn AXL**: workflows are registered onchain in `MarketplaceRegistry`, so
  agents discover and trade them without a central coordinator.
