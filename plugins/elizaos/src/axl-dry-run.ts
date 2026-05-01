export type AxlConnectionType = 'MCP' | 'A2A';

type WorkflowSummaryInput = {
  id: string;
  name: string;
  protocol: string;
  category: string;
  description: string;
  chainId: number | null;
  network: string | null;
  parameters: Record<string, unknown>;
  trigger: unknown;
  actions: readonly {
    contract: string;
    method: string;
    args: readonly string[];
  }[];
};

export type AxlDryRunApiStep = {
  id: string;
  type: 'quote' | 'riskCheck' | 'simulate' | 'buildUnsignedTx';
  label: string;
  dryRunOnly: true;
  sourceActions: WorkflowSummaryInput['actions'];
};

export type AxlRequestPreview = {
  method: 'POST';
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  note: string;
};

type JsonSchemaObject = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type McpToolMetadata = {
  name: string;
  description: string;
  inputSchema: JsonSchemaObject;
  mappedApiStepId?: string;
  dryRunOnly: true;
  wouldExecute?: string;
  wouldCall?: string;
};

export type McpToolRegistry = {
  protocol: 'MCP';
  serviceName: string;
  dryRunOnly: true;
  tools: McpToolMetadata[];
};

export type A2aAgentCard = {
  protocol: 'A2A';
  agentName: string;
  selectedWorkflow: AxlDryRunProjection['selectedWorkflow'];
  inputModes: readonly ['text/plain'];
  outputModes: readonly ['application/json'];
  dryRunOnly: true;
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    mappedWorkflowId: string;
    mappedApiStepIds: string[];
    inputModes: readonly ['text/plain'];
    outputModes: readonly ['application/json'];
    dryRunOnly: true;
  }>;
};

export type AxlDryRunProjection = {
  mode: 'AXL_DRY_RUN';
  axlModeNotice: string;
  connectionType: AxlConnectionType;
  protocol: AxlConnectionType;
  peerId: string;
  serviceName?: string;
  agentName?: string;
  dryRunOnly: true;
  selectedWorkflow: {
    id: string;
    name: string;
    protocol: string;
    category: string;
    chainId: number | null;
    network: string | null;
  };
  apiSteps: AxlDryRunApiStep[];
  mappedApiSteps: AxlDryRunApiStep[];
  mcpToolRegistry: McpToolRegistry;
  globalMcpTools: McpToolMetadata[];
  a2aAgentCard: A2aAgentCard;
  generatedAxlRequestPreview: AxlRequestPreview;
  availableConnectionPreviews: {
    mcp: AxlRequestPreview;
    a2a: AxlRequestPreview;
  };
  defiExecutionPlan: {
    userRequest: string;
    steps: Array<{
      stepId: string;
      action: string;
      result: string;
    }>;
  };
  safety: {
    signing: false;
    broadcast: false;
    requiresUserApproval: true;
    dryRunOnly: true;
  };
};

type CreateAxlDryRunProjectionInput = {
  workflow: WorkflowSummaryInput;
  userRequest: string;
  connectionType?: AxlConnectionType;
  peerId?: string;
  serviceName?: string;
  agentName?: string;
};

export const AXL_DRY_RUN_NOTICE =
  '현재는 AXL dry-run mode이며 실제 배포에서는 localhost:9002의 AXL node를 호출한다.';

const DEFAULT_PEER_ID = 'runtime-peer-id-required';

export function createAxlDryRunProjection(
  input: CreateAxlDryRunProjectionInput,
): AxlDryRunProjection {
  const connectionType = input.connectionType ?? inferConnectionType(input.userRequest);
  const peerId = input.peerId ?? DEFAULT_PEER_ID;
  const serviceName = input.serviceName ?? `loomlabs.${input.workflow.id}`;
  const agentName = input.agentName ?? `${input.workflow.name} Agent`;
  const apiSteps = createApiSteps(input.workflow);
  const mcp = createMcpRequestPreview({ peerId, serviceName });
  const selectedWorkflow = {
    id: input.workflow.id,
    name: input.workflow.name,
    protocol: input.workflow.protocol,
    category: input.workflow.category,
    chainId: input.workflow.chainId,
    network: input.workflow.network,
  };
  const a2a = createA2aRequestPreview({
    peerId,
    agentName,
    workflow: input.workflow,
    userRequest: input.userRequest,
  });

  return {
    mode: 'AXL_DRY_RUN',
    axlModeNotice: AXL_DRY_RUN_NOTICE,
    connectionType,
    protocol: connectionType,
    peerId,
    serviceName: connectionType === 'MCP' ? serviceName : undefined,
    agentName: connectionType === 'A2A' ? agentName : undefined,
    dryRunOnly: true,
    selectedWorkflow,
    apiSteps,
    mappedApiSteps: apiSteps,
    mcpToolRegistry: createMcpToolRegistry({ serviceName, apiSteps }),
    globalMcpTools: createGlobalMcpTools(),
    a2aAgentCard: createA2aAgentCard({
      agentName,
      workflow: input.workflow,
      selectedWorkflow,
      apiSteps,
    }),
    generatedAxlRequestPreview: connectionType === 'MCP' ? mcp : a2a,
    availableConnectionPreviews: { mcp, a2a },
    defiExecutionPlan: {
      userRequest: input.userRequest,
      steps: apiSteps.map((step) => ({
        stepId: step.id,
        action: step.type,
        result: `${step.label} simulation result only; no state-changing API or transaction is executed.`,
      })),
    },
    safety: {
      signing: false,
      broadcast: false,
      requiresUserApproval: true,
      dryRunOnly: true,
    },
  };
}

function inferConnectionType(userRequest: string): AxlConnectionType {
  const request = userRequest.toLowerCase();

  if (request.includes('mcp')) {
    return 'MCP';
  }

  return 'A2A';
}

function createApiSteps(workflow: WorkflowSummaryInput): AxlDryRunApiStep[] {
  const sourceActions = workflow.actions;

  return [
    {
      id: `${workflow.id}:quote`,
      type: 'quote',
      label: `Quote ${workflow.name} parameters and expected DeFi route.`,
      dryRunOnly: true,
      sourceActions,
    },
    {
      id: `${workflow.id}:risk-check`,
      type: 'riskCheck',
      label: `Risk-check ${workflow.protocol} approvals, slippage, and user confirmation needs.`,
      dryRunOnly: true,
      sourceActions,
    },
    {
      id: `${workflow.id}:simulate`,
      type: 'simulate',
      label: `Simulate ${sourceActions.length} workflow action(s) without changing chain state.`,
      dryRunOnly: true,
      sourceActions,
    },
    {
      id: `${workflow.id}:build-unsigned-tx`,
      type: 'buildUnsignedTx',
      label: 'Build unsigned transaction preview only.',
      dryRunOnly: true,
      sourceActions,
    },
  ];
}

function createMcpToolRegistry(input: {
  serviceName: string;
  apiSteps: AxlDryRunApiStep[];
}): McpToolRegistry {
  return {
    protocol: 'MCP',
    serviceName: input.serviceName,
    dryRunOnly: true,
    tools: input.apiSteps.map((step) => ({
      name: step.type,
      description: step.label,
      inputSchema: createWorkflowToolInputSchema(),
      mappedApiStepId: step.id,
      dryRunOnly: true,
      wouldExecute: `Simulate ${step.type} for ${step.id}; no state-changing API or transaction is executed.`,
    })),
  };
}

function createGlobalMcpTools(): McpToolMetadata[] {
  return [
    {
      name: 'browse_marketplace',
      description: 'Browse Loom marketplace listings through the Loom API in a future live mode.',
      inputSchema: {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          protocol: { type: 'string' },
          author: { type: 'string' },
          sort: { type: 'string', enum: ['newest', 'popular'] },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
      dryRunOnly: true,
      wouldCall: 'GET /api/marketplace',
    },
    {
      name: 'create_workflow',
      description:
        'Register a workflow from natural language through the Loom API in a future live mode.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          owner: { type: 'string' },
          chainId: { type: 'number' },
        },
        required: ['prompt', 'owner', 'chainId'],
        additionalProperties: false,
      },
      dryRunOnly: true,
      wouldCall: 'POST /api/workflows',
    },
  ];
}

function createA2aAgentCard(input: {
  agentName: string;
  workflow: WorkflowSummaryInput;
  selectedWorkflow: AxlDryRunProjection['selectedWorkflow'];
  apiSteps: AxlDryRunApiStep[];
}): A2aAgentCard {
  return {
    protocol: 'A2A',
    agentName: input.agentName,
    selectedWorkflow: input.selectedWorkflow,
    inputModes: ['text/plain'],
    outputModes: ['application/json'],
    dryRunOnly: true,
    skills: [
      {
        id: input.workflow.id,
        name: input.workflow.name,
        description: input.workflow.description,
        tags: ['defi', input.workflow.protocol, input.workflow.category, 'automation'],
        mappedWorkflowId: input.workflow.id,
        mappedApiStepIds: input.apiSteps.map((step) => step.id),
        inputModes: ['text/plain'],
        outputModes: ['application/json'],
        dryRunOnly: true,
      },
    ],
  };
}

function createWorkflowToolInputSchema(): JsonSchemaObject {
  return {
    type: 'object',
    properties: {
      workflowId: { type: 'string' },
      parameters: { type: 'object' },
    },
    required: ['workflowId', 'parameters'],
    additionalProperties: false,
  };
}

function createMcpRequestPreview(input: {
  peerId: string;
  serviceName: string;
}): AxlRequestPreview {
  return {
    method: 'POST',
    url: `http://127.0.0.1:9002/mcp/${input.peerId}/${input.serviceName}`,
    headers: {
      'content-type': 'application/json',
    },
    body: {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1,
      params: {},
    },
    note: 'AXL MCP dry-run preview only; no request is sent to localhost:9002.',
  };
}

function createA2aRequestPreview(input: {
  peerId: string;
  agentName: string;
  workflow: WorkflowSummaryInput;
  userRequest: string;
}): AxlRequestPreview {
  return {
    method: 'POST',
    url: `http://127.0.0.1:9002/a2a/${input.peerId}`,
    headers: {
      'content-type': 'application/json',
    },
    body: {
      jsonrpc: '2.0',
      method: 'message/send',
      id: 1,
      params: {
        agentName: input.agentName,
        message: {
          role: 'user',
          parts: [
            {
              kind: 'text',
              text: `${input.userRequest}\n\nrun this DeFi workflow in dry-run mode only`,
            },
          ],
        },
        metadata: {
          selectedWorkflow: input.workflow.id,
          dryRunOnly: true,
        },
      },
    },
    note: 'AXL A2A dry-run preview only; no request is sent to localhost:9002.',
  };
}
