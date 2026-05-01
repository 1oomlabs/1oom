# axl-agents — peer-to-peer workflow exchange over Gensyn AXL

Two standalone Node.js scripts that demonstrate inter-agent communication
across separate AXL nodes:

- `publisher.ts` — builds a `loomlabs.axl.v1` envelope from a sample workflow
  fixture (Aave / Uniswap / Lido), computes a SHA-256 content hash, and POSTs
  it to its local AXL node via `POST /send` to a destination peer id.
- `receiver.ts` — polls its local AXL node `GET /recv`, parses any
  `loomlabs.axl.v1` envelope it sees, and (optionally) forwards the workflow
  to the Loom API to actually deploy it.

Both scripts use raw `fetch` so the integration depth is visible end-to-end:
no plugin internals, just the AXL HTTP bridge.

## Why this exists

Gensyn's *Best Application of Agent eXchange Layer (AXL)* track requires
inter-agent communication across separate AXL nodes, with no central broker
replacing what AXL provides. These scripts run as two independent agents on
two independent AXL nodes; the AXL mesh routes messages between them.

## Prerequisites

1. Build the AXL node binary from
   [`gensyn-ai/axl`](https://github.com/gensyn-ai/axl):

   ```bash
   git clone https://github.com/gensyn-ai/axl.git
   cd axl
   make build           # produces ./node
   ```

2. Generate two ed25519 identity keys (one per node):

   ```bash
   mkdir -p demo/node-a demo/node-b
   /opt/homebrew/bin/openssl genpkey -algorithm ed25519 -out demo/node-a/private.pem
   /opt/homebrew/bin/openssl genpkey -algorithm ed25519 -out demo/node-b/private.pem
   ```

   On macOS the system `openssl` is LibreSSL which lacks ed25519 — install
   real OpenSSL via Homebrew (`brew install openssl@3`) and use the path
   above. Linux builds work with the default `openssl`.

3. Two `node-config.json` files. Note that both nodes share the gVisor
   `tcp_port` value (different IPv6 mesh addresses isolate them) — using
   different ports makes inter-node TCP fail with `connection refused`.

   `demo/node-a/node-config.json` (the listener):
   ```json
   {
     "PrivateKeyPath": "private.pem",
     "Peers": [],
     "Listen": ["tls://0.0.0.0:9001"],
     "api_port": 9002,
     "tcp_port": 7000
   }
   ```

   `demo/node-b/node-config.json` (the spoke):
   ```json
   {
     "PrivateKeyPath": "private.pem",
     "Peers": ["tls://127.0.0.1:9001"],
     "Listen": [],
     "api_port": 9012,
     "tcp_port": 7000
   }
   ```

## Run the demo

Open four terminals.

**Terminal 1 — Node A (publisher's AXL node):**
```bash
cd ~/path/to/axl
./node -config /path/to/demo/node-a/node-config.json
```

Note Node A's `Our Public Key` from the startup log — this is the publisher's
peer id.

**Terminal 2 — Node B (receiver's AXL node):**
```bash
cd ~/path/to/axl
./node -config /path/to/demo/node-b/node-config.json
```

Note Node B's `Our Public Key` — this is the receiver's peer id, used as the
publisher's `AXL_DESTINATION_PEER_ID`.

**Terminal 3 — receiver (polls Node B's HTTP API):**
```bash
cd examples/axl-agents
AXL_NODE_URL=http://127.0.0.1:9012 \
AXL_POLL_INTERVAL_MS=1000 \
  pnpm receive
```

**Terminal 4 — publisher (sends through Node A):**
```bash
cd examples/axl-agents
AXL_NODE_URL=http://127.0.0.1:9002 \
AXL_DESTINATION_PEER_ID=<node-b-public-key> \
PUBLISH_TEMPLATE_ID=lido-stake \
  pnpm publish
```

Expected receiver output:
```
[recv] envelope  from=<node-a-peer-id>...  892B  kind=loom.workflow.publish  template=lido-stake (Lido Sepolia Stake (mock))  protocol=lido/staking  chain=11155111  contentHash=0xfea8278ef4dd9fda…
```

## Optional: bridge to the Loom API

When the receiver runs with `ENABLE_AXL_AGENT_EXECUTION=true` plus a
`LOOM_API_URL` and `LOOM_WORKFLOW_OWNER` (an EOA address), it forwards the
verified envelope to `POST /api/workflows`. The Loom API compiles the
workflow, deploys it to KeeperHub, and returns the new `workflow.id`. This
demonstrates an end-to-end "agent A discovers a workflow over AXL → agent B
deploys it through the loomlabs pipeline" flow without a central broker
between A and B.

```bash
ENABLE_AXL_AGENT_EXECUTION=true \
LOOM_API_URL=https://loomlabsapi-production.up.railway.app \
LOOM_WORKFLOW_OWNER=0x...your_eoa... \
AXL_NODE_URL=http://127.0.0.1:9012 \
  pnpm receive
```

## Templates

`PUBLISH_TEMPLATE_ID` accepts `lido-stake`, `aave-recurring-deposit`, or
`uniswap-dca` — each ships a Sepolia-shaped fixture with concrete parameters.
Add `PUBLISH_LOOP_INTERVAL_MS=5000` to keep broadcasting on a timer for a
sustained demo.

## Files

- `publisher.ts` — envelope builder + AXL `/send` caller.
- `receiver.ts` — `/recv` poller + optional Loom API bridge.
- `package.json` — `pnpm publish` / `pnpm receive` scripts via `tsx`.
