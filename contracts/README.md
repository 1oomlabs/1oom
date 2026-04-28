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

## Lido mock contracts

The Lido Sepolia integration uses mock contracts because the legacy Lido Sepolia
contracts are deprecated. The mock stack keeps the production-facing interface
small and explicit:

- `MockStETH` - mintable ERC20-style stETH token, 18 decimals
- `MockWstETH` - wraps/unwraps `MockStETH` 1:1, 18 decimals
- `MockLido` - exposes `submit(address referral)` and mints `MockStETH` 1:1 for ETH

Local validation:

```bash
cd contracts
forge test
```

Sepolia deployment must be done as a separate approved step because it requires
RPC access and a private key. After deployment, update template metadata with:

```txt
LIDO_MOCK_LIDO_ADDRESS
LIDO_MOCK_STETH_ADDRESS
LIDO_MOCK_WSTETH_ADDRESS
```

Deployment outline:

```bash
cd contracts

forge create src/mocks/MockStETH.sol:MockStETH \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY

forge create src/mocks/MockWstETH.sol:MockWstETH \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY \
  --constructor-args $LIDO_MOCK_STETH_ADDRESS

forge create src/mocks/MockLido.sol:MockLido \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY \
  --constructor-args $LIDO_MOCK_STETH_ADDRESS

cast send $LIDO_MOCK_STETH_ADDRESS "setMinter(address,bool)" \
  $LIDO_MOCK_LIDO_ADDRESS true \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY
```
