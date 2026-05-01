import { getSepoliaTemplateMetadata } from '@loomlabs/templates';

import loomPlugin, { EXECUTION_MODE_ENV_VAR, LIVE_CONFIRMATION_ENV_VAR } from './index';
import {
  CREATE_WORKFLOW_LIVE_ACTION_NAME,
  LIVE_EXECUTION_FEATURE_FLAG,
  LIVE_RUN,
  type LivePreparedTransaction,
  type LiveReadAdapter,
  type LiveReadContractInput,
  type LiveSignerAdapter,
  evaluateLiveExecutionRequest,
  executeLiveExecutionRequest,
  runLiveExecutionGuardTests,
} from './live-execution';

declare const console: {
  log: (message?: unknown, ...optionalParams: unknown[]) => void;
};

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
};

declare global {
  interface ImportMeta {
    url: string;
  }
}

const account = '0x0000000000000000000000000000000000000001' as const;
const link = '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5' as const;
const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const;
const weth = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14' as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function hashFor(index: number): `0x${string}` {
  return `0x${index.toString(16).padStart(64, '0')}`;
}

function createFakeSigner(): LiveSignerAdapter & { sent: LivePreparedTransaction[] } {
  const sent: LivePreparedTransaction[] = [];

  return {
    account,
    sent,
    async sendTransaction(input) {
      sent.push(input);
      return hashFor(sent.length);
    },
  };
}

function createFakeReader(): LiveReadAdapter & { reads: LiveReadContractInput[] } {
  const reads: LiveReadContractInput[] = [];

  return {
    reads,
    async readContract(input) {
      reads.push(input);

      if (input.functionName === 'allowance') {
        return 0n;
      }

      if (input.functionName === 'balanceOf') {
        return 10n ** 30n;
      }

      throw new Error(`Unexpected read function ${input.functionName}`);
    },
    async waitForReceipt() {
      return { status: 'success' };
    },
    async getNativeBalance() {
      return 10n ** 30n;
    },
  };
}

export async function runLiveExecutionSmokeTests(): Promise<string[]> {
  const passed: string[] = [];

  const actionNames = loomPlugin.actions.map((action) => action.name);
  assert(
    actionNames.includes(CREATE_WORKFLOW_LIVE_ACTION_NAME),
    'plugin must expose explicit live-run action name',
  );
  passed.push('CREATE_WORKFLOW_LIVE action is explicit and discoverable');

  const featureOff = evaluateLiveExecutionRequest({
    templateId: 'aave-recurring-deposit',
    chainId: 11155111,
    executionMode: 'live-run',
    confirmLiveExecution: true,
    parameters: { amount: '1' },
    metadata: getSepoliaTemplateMetadata('aave-recurring-deposit'),
  });
  assert(!featureOff.ok, 'feature flag off must block live execution');
  assert(featureOff.code === 'LIVE_EXECUTION_DISABLED', 'feature flag off must be explicit');
  assert(featureOff.safety.canBroadcastTransactions === false, 'blocked result must not broadcast');
  passed.push('feature flag off blocks live execution');

  const missingSigner = evaluateLiveExecutionRequest({
    templateId: 'aave-recurring-deposit',
    chainId: 11155111,
    executionMode: 'live-run',
    confirmLiveExecution: true,
    featureFlags: { [LIVE_EXECUTION_FEATURE_FLAG]: true },
    parameters: { amount: '1' },
    metadata: getSepoliaTemplateMetadata('aave-recurring-deposit'),
  });
  assert(!missingSigner.ok, 'missing signer must block live execution');
  assert(missingSigner.code === 'MISSING_SIGNER', 'missing signer must be explicit');
  passed.push('missing signer blocks live execution');

  const missingReader = evaluateLiveExecutionRequest({
    templateId: 'aave-recurring-deposit',
    chainId: 11155111,
    executionMode: 'live-run',
    confirmLiveExecution: true,
    featureFlags: { [LIVE_EXECUTION_FEATURE_FLAG]: true },
    signer: createFakeSigner(),
    parameters: { amount: '1' },
    metadata: getSepoliaTemplateMetadata('aave-recurring-deposit'),
  });
  assert(!missingReader.ok, 'missing reader must block live execution');
  assert(missingReader.code === 'MISSING_READER', 'missing reader must be explicit');
  passed.push('missing reader blocks live execution');

  const uniswapUnsafeSlippage = evaluateLiveExecutionRequest({
    templateId: 'uniswap-dca',
    chainId: 11155111,
    executionMode: 'live-run',
    confirmLiveExecution: true,
    featureFlags: { [LIVE_EXECUTION_FEATURE_FLAG]: true },
    signer: createFakeSigner(),
    reader: createFakeReader(),
    parameters: { tokenIn: usdc, tokenOut: weth, amountIn: '1000000', amountOutMinimum: '0' },
    metadata: getSepoliaTemplateMetadata('uniswap-dca'),
  });
  assert(!uniswapUnsafeSlippage.ok, 'zero amountOutMinimum must block Uniswap live execution');
  assert(
    uniswapUnsafeSlippage.code === 'SLIPPAGE_POLICY_VIOLATION',
    'zero amountOutMinimum must be a slippage policy violation',
  );
  passed.push('Uniswap amountOutMinimum=0 is rejected');

  const aaveSigner = createFakeSigner();
  const aaveResult = await executeLiveExecutionRequest({
    templateId: 'aave-recurring-deposit',
    chainId: 11155111,
    executionMode: 'live-run',
    confirmLiveExecution: true,
    featureFlags: { [LIVE_EXECUTION_FEATURE_FLAG]: true },
    signer: aaveSigner,
    reader: createFakeReader(),
    parameters: { token: link, amount: '1000000000000000000' },
    metadata: getSepoliaTemplateMetadata('aave-recurring-deposit'),
  });
  assert(aaveResult.ok, 'Aave live execution must execute through adapters');
  assert(aaveResult.transactionHashes.length === 2, 'Aave must approve and supply');
  assert(
    aaveResult.transactions.map((tx) => tx.step).join(',') === 'erc20-approve,aave-supply',
    'Aave transaction sequence must be approve then supply',
  );
  assert(aaveSigner.sent.length === 2, 'Aave signer must receive two transactions');
  passed.push('Aave live execution broadcasts approve and supply through adapters');

  const uniswapSigner = createFakeSigner();
  const uniswapResult = await executeLiveExecutionRequest({
    templateId: 'uniswap-dca',
    chainId: 11155111,
    executionMode: 'live-run',
    confirmLiveExecution: true,
    featureFlags: { [LIVE_EXECUTION_FEATURE_FLAG]: true },
    signer: uniswapSigner,
    reader: createFakeReader(),
    parameters: {
      tokenIn: usdc,
      tokenOut: weth,
      amountIn: '1000000',
      amountOutMinimum: '1',
      feeTier: 500,
    },
    metadata: getSepoliaTemplateMetadata('uniswap-dca'),
  });
  assert(uniswapResult.ok, 'Uniswap live execution must execute through adapters');
  assert(uniswapResult.transactionHashes.length === 2, 'Uniswap must approve and swap');
  assert(
    uniswapResult.transactions.map((tx) => tx.step).join(',') ===
      'erc20-approve,uniswap-exact-input-single',
    'Uniswap transaction sequence must be approve then exactInputSingle',
  );
  passed.push('Uniswap live execution broadcasts approve and exactInputSingle through adapters');

  const lidoSigner = createFakeSigner();
  const lidoResult = await executeLiveExecutionRequest({
    templateId: 'lido-stake',
    chainId: 11155111,
    executionMode: 'live-run',
    confirmLiveExecution: true,
    featureFlags: { [LIVE_EXECUTION_FEATURE_FLAG]: true },
    signer: lidoSigner,
    reader: createFakeReader(),
    parameters: { amount: '1000000000000000' },
    metadata: getSepoliaTemplateMetadata('lido-stake'),
  });
  assert(lidoResult.ok, 'Lido mock live execution must execute through adapters');
  assert(lidoResult.transactionHashes.length === 3, 'Lido mock must submit, approve, and wrap');
  assert(
    lidoResult.transactions.map((tx) => tx.step).join(',') ===
      'lido-mock-submit,steth-approve,wsteth-wrap',
    'Lido mock transaction sequence must be submit, approve, wrap',
  );
  assert(
    lidoResult.transactions[0]?.value === 1000000000000000n,
    'Lido submit must carry ETH value',
  );
  passed.push('Lido mock live execution broadcasts submit, approve, and wrap through adapters');

  const liveAction = loomPlugin.actions.find(
    (action) => action.name === CREATE_WORKFLOW_LIVE_ACTION_NAME,
  );
  const actionSigner = createFakeSigner();
  assert(liveAction, 'CREATE_WORKFLOW_LIVE action must exist');

  const actionResult = await liveAction.handler(
    {} as never,
    {
      content: { text: 'deposit LINK to Aave', source: 'live-execution-smoke-test' },
    } as never,
    undefined,
    {
      parameters: {
        confirmLiveExecution: true,
        featureFlags: { [LIVE_EXECUTION_FEATURE_FLAG]: true },
        signer: actionSigner,
        reader: createFakeReader(),
        parameters: { token: link, amount: '1000000000000000000' },
      },
    } as never,
    undefined,
    [],
  );
  assert(actionResult?.success === true, 'CREATE_WORKFLOW_LIVE action must execute via adapters');
  assert(actionSigner.sent.length === 2, 'CREATE_WORKFLOW_LIVE action must broadcast Aave plan');
  passed.push('CREATE_WORKFLOW_LIVE action executes through injected adapters');

  const createWorkflow = loomPlugin.actions.find((action) => action.name === 'CREATE_WORKFLOW');
  const modeBefore = process.env[EXECUTION_MODE_ENV_VAR];
  const featureBefore = process.env[LIVE_EXECUTION_FEATURE_FLAG];
  const confirmationBefore = process.env[LIVE_CONFIRMATION_ENV_VAR];
  const envModeSigner = createFakeSigner();

  try {
    process.env[EXECUTION_MODE_ENV_VAR] = LIVE_RUN;
    process.env[LIVE_EXECUTION_FEATURE_FLAG] = 'true';
    process.env[LIVE_CONFIRMATION_ENV_VAR] = 'true';

    assert(createWorkflow, 'CREATE_WORKFLOW action must exist');
    const envModeResult = await createWorkflow.handler(
      {} as never,
      {
        content: { text: 'deposit LINK to Aave', source: 'env-mode-smoke-test' },
      } as never,
      undefined,
      {
        parameters: {
          signer: envModeSigner,
          reader: createFakeReader(),
          parameters: { token: link, amount: '1000000000000000000' },
        },
      } as never,
      undefined,
      [],
    );

    assert(envModeResult?.success === true, 'CREATE_WORKFLOW must honor live-run env mode');
    assert(
      envModeSigner.sent.length === 2,
      'env live-run CREATE_WORKFLOW must broadcast Aave plan',
    );
  } finally {
    process.env[EXECUTION_MODE_ENV_VAR] = modeBefore;
    process.env[LIVE_EXECUTION_FEATURE_FLAG] = featureBefore;
    process.env[LIVE_CONFIRMATION_ENV_VAR] = confirmationBefore;
  }
  passed.push('CREATE_WORKFLOW switches to live-run from environment variables');

  const directGuardCases = runLiveExecutionGuardTests();
  passed.push(...directGuardCases);

  return passed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const passed = await runLiveExecutionSmokeTests();
  console.log(JSON.stringify({ ok: true, passed }, null, 2));
}
