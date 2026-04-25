# contracts

Solidity contracts for the loomlabs onchain layer. Built with Foundry.

## Scope

- `MarketplaceRegistry.sol` - onchain registry of workflow listings. Primary
  integration point for the Gensyn AXL track: agents use this registry to
  publish and discover workflows without a central coordinator.

## Setup

```bash
# install forge: https://book.getfoundry.sh/getting-started/installation
curl -L https://foundry.paradigm.xyz | bash && foundryup

cd contracts
forge install foundry-rs/forge-std --no-commit
forge build
forge test
```

## Env

Create `.env` in this directory:

```
SEPOLIA_RPC_URL=
MAINNET_RPC_URL=
PRIVATE_KEY=
```

## Deploy (sepolia)

```bash
forge script script/Deploy.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --private-key $PRIVATE_KEY
```
