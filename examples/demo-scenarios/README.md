# Demo scenarios

End-to-end demo scripts used in the 4-minute judging video.

## Scenario 1: "Alice creates a recurring Aave deposit"

1. Alice opens the app, connects wallet (Sepolia).
2. Types: "Deposit 100 USDC into Aave every Friday".
3. The LLM maps this to `aave-recurring-deposit` with `amount=100e6`,
   `interval=7d`.
4. KeeperHub deploys the job. Status shows `active`.
5. Alice publishes the workflow to the marketplace with `pricing: free`.

## Scenario 2: "Bob's agent finds and subscribes"

1. Bob's ElizaOS agent calls `BROWSE_MARKETPLACE`.
2. The agent picks Alice's listing via `CREATE_WORKFLOW` with its own parameters.
3. The registry contract records Bob's re-deployment.
4. Demonstrates: agent <-> agent workflow sharing via onchain registry.

## Scripts

- `scenario-1.ts` - TODO
- `scenario-2.ts` - TODO
