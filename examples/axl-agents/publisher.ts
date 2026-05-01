export {};
// Standalone publisher agent that sends a sample workflow envelope through
// the local Gensyn AXL node. The receiver script (running on a separate AXL
// node) picks the envelope up via /recv.
//
// Run:
//   AXL_NODE_URL=http://127.0.0.1:9002 \
//   AXL_DESTINATION_PEER_ID=<receiver-public-key-hex> \
//   tsx publisher.ts
//
// Optional env:
//   PUBLISH_TEMPLATE_ID=lido-stake|aave-recurring-deposit|uniswap-dca  (default lido-stake)
//   PUBLISH_LOOP_INTERVAL_MS=0   (>0 keeps publishing every Nms)

const AXL_NODE_URL = process.env.AXL_NODE_URL ?? 'http://127.0.0.1:9002';
const AXL_DESTINATION_PEER_ID = process.env.AXL_DESTINATION_PEER_ID;
const PUBLISH_TEMPLATE_ID = process.env.PUBLISH_TEMPLATE_ID ?? 'lido-stake';
const LOOP_INTERVAL_MS = Number(process.env.PUBLISH_LOOP_INTERVAL_MS ?? 0);

if (!AXL_DESTINATION_PEER_ID) {
  console.error(
    'AXL_DESTINATION_PEER_ID is required. Read the consumer node\'s "our_public_key" from /topology and pass it.',
  );
  process.exit(1);
}

type WorkflowFixture = {
  templateId: string;
  templateName: string;
  protocol: string;
  category: string;
  chainId: number;
  network: string;
  parameters: Record<string, unknown>;
  trigger: { type: 'cron'; expression: string };
  actions: ReadonlyArray<{ contract: string; method: string; args: string[] }>;
};

const FIXTURES: Record<string, WorkflowFixture> = {
  'lido-stake': {
    templateId: 'lido-stake',
    templateName: 'Lido Sepolia Stake (mock)',
    protocol: 'lido',
    category: 'staking',
    chainId: 11155111,
    network: 'sepolia',
    parameters: {
      amount: '1000000000000000000',
      referral: '0x0000000000000000000000000000000000000000',
    },
    trigger: { type: 'cron', expression: '@weekly' },
    actions: [
      { contract: 'MockLido', method: 'submit', args: ['address'] },
      { contract: 'MockWstETH', method: 'wrap', args: ['uint256'] },
    ],
  },
  'aave-recurring-deposit': {
    templateId: 'aave-recurring-deposit',
    templateName: 'Aave USDC Recurring Deposit',
    protocol: 'aave',
    category: 'yield',
    chainId: 11155111,
    network: 'sepolia',
    parameters: {
      token: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
      amount: '100000000',
    },
    trigger: { type: 'cron', expression: '@weekly' },
    actions: [
      { contract: 'ERC20', method: 'approve', args: ['address', 'uint256'] },
      { contract: 'AavePool', method: 'supply', args: ['address', 'uint256', 'address', 'uint16'] },
    ],
  },
  'uniswap-dca': {
    templateId: 'uniswap-dca',
    templateName: 'Uniswap V3 DCA',
    protocol: 'uniswap',
    category: 'dca',
    chainId: 11155111,
    network: 'sepolia',
    parameters: {
      tokenIn: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
      tokenOut: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
      amountIn: '100000000',
      amountOutMinimum: '95000000000000000',
      feeTier: 3000,
    },
    trigger: { type: 'cron', expression: '@weekly' },
    actions: [
      { contract: 'ERC20', method: 'approve', args: ['address', 'uint256'] },
      { contract: 'UniswapRouter', method: 'exactInputSingle', args: ['(...)'] },
    ],
  },
};

function loadFixture(): WorkflowFixture {
  const f = FIXTURES[PUBLISH_TEMPLATE_ID];
  if (f) return f;
  console.error(
    `Unknown template id ${PUBLISH_TEMPLATE_ID}. Use one of: ${Object.keys(FIXTURES).join(', ')}.`,
  );
  process.exit(1);
}

const fixture: WorkflowFixture = loadFixture();

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableJson(value));
}

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableJson);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortForStableJson(nested)]),
  );
}

function hex(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  return `0x${Array.from(view, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function buildEnvelope(): Promise<Record<string, unknown>> {
  const canonicalJson = stableStringify(fixture);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson));
  const contentHash = hex(digest);
  const uri = `loom://workflow/${fixture.templateId}/${contentHash}`;

  return {
    version: 'loomlabs.axl.v1',
    kind: 'loom.workflow.publish',
    transport: 'axl.raw',
    route: {
      sendEndpoint: '/send',
      recvEndpoint: '/recv',
      destinationPeerId: AXL_DESTINATION_PEER_ID,
    },
    payload: {
      contentHash,
      uri,
      workflow: fixture,
    },
    issuedAt: Date.now(),
  };
}

async function sendOnce(): Promise<void> {
  const envelope = await buildEnvelope();
  const body = new TextEncoder().encode(JSON.stringify(envelope));
  const response = await fetch(`${AXL_NODE_URL}/send`, {
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-destination-peer-id': AXL_DESTINATION_PEER_ID as string,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`[axl] ${response.status} ${response.statusText}: ${text}`);
  }

  const sentBytes = response.headers.get('x-sent-bytes');
  console.log(
    `[publish] sent  template=${fixture.templateId}  bytes=${sentBytes ?? body.length}  → peer=${AXL_DESTINATION_PEER_ID?.slice(0, 16)}…`,
  );
}

async function main(): Promise<void> {
  console.log(
    `[publish] node=${AXL_NODE_URL}  destination=${AXL_DESTINATION_PEER_ID?.slice(0, 16)}…  template=${PUBLISH_TEMPLATE_ID}`,
  );
  await sendOnce();

  if (LOOP_INTERVAL_MS > 0) {
    console.log(`[publish] looping every ${LOOP_INTERVAL_MS}ms (Ctrl-C to stop)`);
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, LOOP_INTERVAL_MS));
      try {
        await sendOnce();
      } catch (err) {
        console.error(`[publish] send failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
