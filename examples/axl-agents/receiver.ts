export {};
// Standalone receiver agent that polls a local Gensyn AXL node for inbound
// messages and prints any loomlabs workflow envelope it sees. Optionally
// forwards the payload to the Loom API so the receiving agent actually
// deploys the workflow it discovered over the AXL mesh.
//
// Run:
//   AXL_NODE_URL=http://127.0.0.1:9012 tsx receiver.ts
//
// Optional env (to actually deploy received workflows):
//   LOOM_API_URL=https://loomlabsapi-production.up.railway.app
//   LOOM_WORKFLOW_OWNER=0x<eoa>
//   ENABLE_AXL_AGENT_EXECUTION=true
//
// Optional env (to also publish the deployed workflow to the marketplace,
// tagged "axl-agent" so judges can see AXL-discovered listings in the UI):
//   LOOM_AUTO_PUBLISH_TO_MARKETPLACE=true

const AXL_NODE_URL = process.env.AXL_NODE_URL ?? 'http://127.0.0.1:9012';
const LOOM_API_URL = process.env.LOOM_API_URL?.replace(/\/$/, '');
const LOOM_WORKFLOW_OWNER = process.env.LOOM_WORKFLOW_OWNER;
const ENABLE_EXECUTION = process.env.ENABLE_AXL_AGENT_EXECUTION === 'true';
const AUTO_PUBLISH = process.env.LOOM_AUTO_PUBLISH_TO_MARKETPLACE === 'true';
const POLL_INTERVAL_MS = Number(process.env.AXL_POLL_INTERVAL_MS ?? 2000);

type AxlEnvelope = {
  version: string;
  kind: string;
  transport: string;
  route?: { destinationPeerId?: string };
  payload: {
    contentHash: string;
    uri: string;
    workflow: {
      templateId: string;
      templateName: string;
      protocol: string;
      category: string;
      chainId: number | null;
      network: string | null;
      parameters: Record<string, unknown>;
      [key: string]: unknown;
    };
  };
};

type ReceivedMessage = {
  fromPeerId: string | null;
  bodyText: string;
  envelope?: AxlEnvelope;
};

async function pollOnce(): Promise<ReceivedMessage | null> {
  const response = await fetch(`${AXL_NODE_URL}/recv`);

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`[axl] ${response.status} ${response.statusText}: ${body}`);
  }

  const bodyText = await response.text();
  const envelope = parseAxlEnvelope(bodyText);
  return {
    fromPeerId: response.headers.get('x-from-peer-id'),
    bodyText,
    envelope,
  };
}

function parseAxlEnvelope(bodyText: string): AxlEnvelope | undefined {
  try {
    const parsed = JSON.parse(bodyText) as Partial<AxlEnvelope>;
    if (
      parsed.version !== 'loomlabs.axl.v1' ||
      parsed.transport !== 'axl.raw' ||
      !parsed.payload ||
      typeof parsed.payload !== 'object'
    ) {
      return undefined;
    }
    return parsed as AxlEnvelope;
  } catch {
    return undefined;
  }
}

async function executeReceivedWorkflow(envelope: AxlEnvelope): Promise<void> {
  if (!ENABLE_EXECUTION) {
    return;
  }
  if (!LOOM_API_URL || !LOOM_WORKFLOW_OWNER) {
    console.warn(
      '[recv] execution skipped: LOOM_API_URL and LOOM_WORKFLOW_OWNER must be set when ENABLE_AXL_AGENT_EXECUTION=true.',
    );
    return;
  }

  const workflow = envelope.payload.workflow;
  const prompt = `Execute received AXL workflow ${workflow.templateId} (${workflow.templateName}). Parameters: ${JSON.stringify(workflow.parameters)}.`;
  const res = await fetch(`${LOOM_API_URL}/api/workflows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      owner: LOOM_WORKFLOW_OWNER,
      chainId: workflow.chainId ?? 11155111,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[loom-api] ${res.status} ${res.statusText}: ${body}`);
    return;
  }
  const json = (await res.json()) as { workflow?: { id?: string } };
  const workflowId = json.workflow?.id;
  console.log(`  -> deployed via Loom API: workflow.id=${workflowId ?? '<unknown>'}`);

  if (AUTO_PUBLISH && workflowId && LOOM_API_URL && LOOM_WORKFLOW_OWNER) {
    await publishToMarketplace(workflowId, envelope);
  }
}

async function publishToMarketplace(workflowId: string, envelope: AxlEnvelope): Promise<void> {
  if (!LOOM_API_URL || !LOOM_WORKFLOW_OWNER) {
    return;
  }

  const res = await fetch(`${LOOM_API_URL}/api/marketplace`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      workflowId,
      author: LOOM_WORKFLOW_OWNER,
      tags: ['axl-agent', 'received-via-mesh', envelope.payload.workflow.protocol],
      pricing: { type: 'free' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[loom-api] marketplace publish failed ${res.status}: ${body}`);
    return;
  }

  const json = (await res.json()) as { listing?: { id?: string } };
  console.log(`  -> published to marketplace: listing.id=${json.listing?.id ?? '<unknown>'}`);
}

function describeEnvelope(env: AxlEnvelope): string {
  const w = env.payload.workflow;
  return [
    `kind=${env.kind}`,
    `template=${w.templateId} (${w.templateName})`,
    `protocol=${w.protocol}/${w.category}`,
    `chain=${w.chainId ?? 'unknown'}`,
    `contentHash=${env.payload.contentHash.slice(0, 18)}…`,
  ].join('  ');
}

async function main(): Promise<void> {
  console.log(`[recv] polling ${AXL_NODE_URL}/recv every ${POLL_INTERVAL_MS}ms (Ctrl-C to stop)`);
  console.log(
    `[recv] execution: ${ENABLE_EXECUTION ? 'enabled' : 'disabled'} | auto-publish: ${AUTO_PUBLISH ? 'on' : 'off'} | loom-api: ${LOOM_API_URL ?? '<unset>'}`,
  );

  while (true) {
    try {
      const message = await pollOnce();
      if (message) {
        const headerSummary = `from=${message.fromPeerId?.slice(0, 16) ?? 'unknown'}…  ${message.bodyText.length}B`;
        if (message.envelope) {
          console.log(`[recv] envelope  ${headerSummary}  ${describeEnvelope(message.envelope)}`);
          await executeReceivedWorkflow(message.envelope).catch((err: unknown) => {
            console.error(
              `[recv] execution failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        } else {
          console.log(
            `[recv] non-envelope payload  ${headerSummary}  body=${message.bodyText.slice(0, 80)}`,
          );
        }
      }
    } catch (err) {
      console.error(`[recv] poll failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

void main();
