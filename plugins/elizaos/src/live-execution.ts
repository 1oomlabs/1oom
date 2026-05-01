import {
  HUMAN_CONFIRMED,
  SEPOLIA_CHAIN_ID,
  type SepoliaAbiFragment,
  type SepoliaContractMetadata,
  type SepoliaTemplateMetadata,
} from '@loomlabs/templates';
import { type Abi, type Address, type Hex, encodeFunctionData, isAddress } from 'viem';

export const LIVE_RUN = 'live-run' as const;
export const CREATE_WORKFLOW_LIVE_ACTION_NAME = 'CREATE_WORKFLOW_LIVE' as const;
export const LIVE_EXECUTION_FEATURE_FLAG = 'LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION' as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export type LiveExecutionMode = typeof LIVE_RUN;

export type LiveExecutionErrorCode =
  | 'LIVE_EXECUTION_DISABLED'
  | 'LIVE_CONFIRMATION_REQUIRED'
  | 'UNSUPPORTED_CHAIN'
  | 'MISSING_SIGNER'
  | 'MISSING_READER'
  | 'UNCONFIRMED_METADATA'
  | 'INVALID_PARAMETERS'
  | 'INSUFFICIENT_BALANCE'
  | 'SLIPPAGE_POLICY_VIOLATION'
  | 'TRANSACTION_REVERTED'
  | 'POST_CHECK_FAILED';

export type LiveExecutionFeatureFlags = Partial<
  Record<typeof LIVE_EXECUTION_FEATURE_FLAG, boolean | 'true' | 'false'>
>;

export type LivePreparedTransaction = {
  step: string;
  to: Address;
  data: Hex;
  value?: bigint;
  description: string;
};

export type LiveReceiptSummary = {
  status: 'success' | 'reverted';
  blockNumber?: bigint | number;
};

export type LiveSignerAdapter = {
  account?: Address;
  sendTransaction(input: LivePreparedTransaction): Promise<Hex>;
};

export type LiveReadContractInput = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};

export type LiveReadAdapter = {
  readContract(input: LiveReadContractInput): Promise<unknown>;
  waitForReceipt(hash: Hex): Promise<LiveReceiptSummary>;
  getNativeBalance?(account: Address): Promise<bigint>;
};

export type LiveExecutionRequest = {
  templateId: string;
  chainId: number;
  executionMode: LiveExecutionMode;
  confirmLiveExecution: boolean;
  parameters: Record<string, unknown>;
  metadata?: SepoliaTemplateMetadata;
  featureFlags?: LiveExecutionFeatureFlags;
  signer?: LiveSignerAdapter;
  reader?: LiveReadAdapter;
  account?: Address;
};

export type LiveExecutionBlockedResult = {
  ok: false;
  status: 'blocked';
  requestedExecutionMode: LiveExecutionMode;
  code: LiveExecutionErrorCode;
  reason: string;
  templateId: string;
  chainId: number;
  safety: LiveExecutionSafety;
};

export type LiveExecutionReadyResult = {
  ok: true;
  status: 'ready';
  requestedExecutionMode: LiveExecutionMode;
  templateId: string;
  chainId: typeof SEPOLIA_CHAIN_ID;
  account: Address;
  safety: LiveExecutionSafety;
};

export type LiveExecutionSuccessResult = {
  ok: true;
  status: 'executed';
  requestedExecutionMode: LiveExecutionMode;
  templateId: string;
  chainId: typeof SEPOLIA_CHAIN_ID;
  account: Address;
  transactions: LivePreparedTransaction[];
  transactionHashes: Hex[];
  receipts: LiveReceiptSummary[];
  postChecks: Record<string, unknown>;
  safety: LiveExecutionSafety;
};

export type LiveExecutionResult = LiveExecutionBlockedResult | LiveExecutionReadyResult;
export type LiveExecutionRunResult = LiveExecutionBlockedResult | LiveExecutionSuccessResult;

type LiveExecutionSafety = {
  canPrepareTransactions: boolean;
  canBroadcastTransactions: boolean;
  callsKeeperHub: false;
  callsExternalLlm: false;
  callsAppApi: false;
  requiresSigner: boolean;
  requiresRpc: boolean;
  requiresPrivateKey: false;
  executionBlockedBy: string[];
};

type LiveTemplatePlan = {
  transactions: LivePreparedTransaction[];
  postChecks: Array<{
    name: string;
    call: LiveReadContractInput;
  }>;
};

function isLiveFeatureEnabled(flags: LiveExecutionFeatureFlags | undefined): boolean {
  return (
    flags?.[LIVE_EXECUTION_FEATURE_FLAG] === true || flags?.[LIVE_EXECUTION_FEATURE_FLAG] === 'true'
  );
}

function blockedResult(
  request: LiveExecutionRequest,
  code: LiveExecutionErrorCode,
  reason: string,
  executionBlockedBy: string[] = [code],
): LiveExecutionBlockedResult {
  return {
    ok: false,
    status: 'blocked',
    requestedExecutionMode: LIVE_RUN,
    code,
    reason,
    templateId: request.templateId,
    chainId: request.chainId,
    safety: {
      canPrepareTransactions: false,
      canBroadcastTransactions: false,
      callsKeeperHub: false,
      callsExternalLlm: false,
      callsAppApi: false,
      requiresSigner: false,
      requiresRpc: false,
      requiresPrivateKey: false,
      executionBlockedBy,
    },
  };
}

function readyResult(request: LiveExecutionRequest, account: Address): LiveExecutionReadyResult {
  return {
    ok: true,
    status: 'ready',
    requestedExecutionMode: LIVE_RUN,
    templateId: request.templateId,
    chainId: SEPOLIA_CHAIN_ID,
    account,
    safety: {
      canPrepareTransactions: true,
      canBroadcastTransactions: true,
      callsKeeperHub: false,
      callsExternalLlm: false,
      callsAppApi: false,
      requiresSigner: true,
      requiresRpc: true,
      requiresPrivateKey: false,
      executionBlockedBy: [],
    },
  };
}

function hasConfirmedMetadata(metadata: SepoliaTemplateMetadata | undefined): boolean {
  if (
    !metadata ||
    metadata.requiresHumanConfirmation ||
    metadata.unresolvedHumanConfirmations.length > 0
  ) {
    return false;
  }

  return metadata.contracts.every((contract) => {
    const addressConfirmed =
      contract.address.kind !== 'protocol-address' && contract.address.kind !== 'mock-address'
        ? true
        : contract.address.confirmation === HUMAN_CONFIRMED;

    return addressConfirmed && contract.abi.status === HUMAN_CONFIRMED;
  });
}

function isZeroAmountOutMinimum(value: unknown): boolean {
  return value === 0 || value === 0n || value === '0' || value === '0.0';
}

function hasSigner(value: unknown): value is LiveSignerAdapter {
  return Boolean(value) && typeof (value as LiveSignerAdapter).sendTransaction === 'function';
}

function hasReader(value: unknown): value is LiveReadAdapter {
  const reader = value as LiveReadAdapter;
  return (
    Boolean(value) &&
    typeof reader.readContract === 'function' &&
    typeof reader.waitForReceipt === 'function'
  );
}

function accountFor(request: LiveExecutionRequest): Address | undefined {
  return request.account ?? request.signer?.account;
}

export function evaluateLiveExecutionRequest(request: LiveExecutionRequest): LiveExecutionResult {
  if (!isLiveFeatureEnabled(request.featureFlags)) {
    return blockedResult(
      request,
      'LIVE_EXECUTION_DISABLED',
      `${LIVE_EXECUTION_FEATURE_FLAG} is not enabled; live-run remains blocked by default.`,
    );
  }

  if (request.chainId !== SEPOLIA_CHAIN_ID) {
    return blockedResult(request, 'UNSUPPORTED_CHAIN', 'Only Sepolia chainId 11155111 is allowed.');
  }

  if (request.confirmLiveExecution !== true) {
    return blockedResult(
      request,
      'LIVE_CONFIRMATION_REQUIRED',
      'Live execution requires explicit confirmLiveExecution=true.',
    );
  }

  if (!hasSigner(request.signer)) {
    return blockedResult(
      request,
      'MISSING_SIGNER',
      'Live execution requires a host-injected signer adapter.',
    );
  }

  if (!hasReader(request.reader)) {
    return blockedResult(
      request,
      'MISSING_READER',
      'Live execution requires a host-injected read adapter.',
    );
  }

  const account = accountFor(request);

  if (!isAddressValue(account)) {
    return blockedResult(
      request,
      'INVALID_PARAMETERS',
      'Live execution requires a valid account address from request.account or signer.account.',
    );
  }

  if (!hasConfirmedMetadata(request.metadata)) {
    return blockedResult(
      request,
      'UNCONFIRMED_METADATA',
      'All contract addresses and ABI fragments must be human-confirmed before live-run.',
    );
  }

  if (
    request.templateId === 'uniswap-dca' &&
    isZeroAmountOutMinimum(request.parameters.amountOutMinimum)
  ) {
    return blockedResult(
      request,
      'SLIPPAGE_POLICY_VIOLATION',
      'Uniswap live-run must not use amountOutMinimum=0.',
    );
  }

  return readyResult(request, account);
}

export async function executeLiveExecutionRequest(
  request: LiveExecutionRequest,
): Promise<LiveExecutionRunResult> {
  const validation = evaluateLiveExecutionRequest(request);

  if (!validation.ok) {
    return validation;
  }

  const signer = request.signer;
  const reader = request.reader;
  const metadata = request.metadata;

  if (!signer || !reader || !metadata) {
    return blockedResult(request, 'INVALID_PARAMETERS', 'Validated live request is incomplete.');
  }

  const planResult = await createLiveTemplatePlanSafely(
    request,
    validation.account,
    metadata,
    reader,
  );

  if (!planResult.ok) {
    return planResult;
  }

  const receipts: LiveReceiptSummary[] = [];
  const transactionHashes: Hex[] = [];

  for (const transaction of planResult.plan.transactions) {
    const hash = await sendTransactionSafely(request, signer, transaction);

    if (!hash.ok) {
      return hash;
    }

    const receipt = await waitForReceiptSafely(request, reader, hash.value, transaction);

    if (!receipt.ok) {
      return receipt;
    }

    transactionHashes.push(hash.value);
    receipts.push(receipt.value);

    if (receipt.value.status !== 'success') {
      return blockedResult(
        request,
        'TRANSACTION_REVERTED',
        `${transaction.step} reverted; remaining live execution steps were not broadcast.`,
        ['TRANSACTION_REVERTED', transaction.step],
      );
    }
  }

  const postChecks: Record<string, unknown> = {};

  for (const postCheck of planResult.plan.postChecks) {
    try {
      postChecks[postCheck.name] = await reader.readContract(postCheck.call);
    } catch (error) {
      return blockedResult(
        request,
        'POST_CHECK_FAILED',
        `${postCheck.name} failed: ${errorMessage(error)}`,
        ['POST_CHECK_FAILED', postCheck.name],
      );
    }
  }

  return {
    ok: true,
    status: 'executed',
    requestedExecutionMode: LIVE_RUN,
    templateId: request.templateId,
    chainId: SEPOLIA_CHAIN_ID,
    account: validation.account,
    transactions: planResult.plan.transactions,
    transactionHashes,
    receipts,
    postChecks,
    safety: validation.safety,
  };
}

async function createLiveTemplatePlanSafely(
  request: LiveExecutionRequest,
  account: Address,
  metadata: SepoliaTemplateMetadata,
  reader: LiveReadAdapter,
): Promise<{ ok: true; plan: LiveTemplatePlan } | LiveExecutionBlockedResult> {
  try {
    return await createLiveTemplatePlan(request, account, metadata, reader);
  } catch (error) {
    return blockedResult(
      request,
      'INVALID_PARAMETERS',
      `Live preflight failed: ${errorMessage(error)}`,
      ['INVALID_PARAMETERS', 'preflight-failed'],
    );
  }
}

async function sendTransactionSafely(
  request: LiveExecutionRequest,
  signer: LiveSignerAdapter,
  transaction: LivePreparedTransaction,
): Promise<{ ok: true; value: Hex } | LiveExecutionBlockedResult> {
  try {
    return { ok: true, value: await signer.sendTransaction(transaction) };
  } catch (error) {
    return blockedResult(
      request,
      'TRANSACTION_REVERTED',
      `${transaction.step} send failed: ${errorMessage(error)}`,
      ['TRANSACTION_REVERTED', transaction.step],
    );
  }
}

async function waitForReceiptSafely(
  request: LiveExecutionRequest,
  reader: LiveReadAdapter,
  hash: Hex,
  transaction: LivePreparedTransaction,
): Promise<{ ok: true; value: LiveReceiptSummary } | LiveExecutionBlockedResult> {
  try {
    return { ok: true, value: await reader.waitForReceipt(hash) };
  } catch (error) {
    return blockedResult(
      request,
      'TRANSACTION_REVERTED',
      `${transaction.step} receipt failed: ${errorMessage(error)}`,
      ['TRANSACTION_REVERTED', transaction.step],
    );
  }
}

async function createLiveTemplatePlan(
  request: LiveExecutionRequest,
  account: Address,
  metadata: SepoliaTemplateMetadata,
  reader: LiveReadAdapter,
): Promise<{ ok: true; plan: LiveTemplatePlan } | LiveExecutionBlockedResult> {
  switch (request.templateId) {
    case 'aave-recurring-deposit':
      return createAavePlan(request, account, metadata, reader);
    case 'uniswap-dca':
      return createUniswapPlan(request, account, metadata, reader);
    case 'lido-stake':
      return createLidoPlan(request, account, metadata, reader);
    default:
      return blockedResult(
        request,
        'INVALID_PARAMETERS',
        `Unsupported live template: ${request.templateId}`,
      );
  }
}

async function createAavePlan(
  request: LiveExecutionRequest,
  account: Address,
  metadata: SepoliaTemplateMetadata,
  reader: LiveReadAdapter,
): Promise<{ ok: true; plan: LiveTemplatePlan } | LiveExecutionBlockedResult> {
  const erc20 = contractByName(metadata, 'ERC20');
  const aavePool = contractByName(metadata, 'AavePool');
  const aToken = contractByName(metadata, 'AaveAToken');
  const token = addressParameter(request, 'token');
  const amount = bigintParameter(request, 'amount');

  if (!erc20 || !aavePool || !aToken || !token || amount === undefined) {
    return blockedResult(request, 'INVALID_PARAMETERS', 'Aave live-run requires token and amount.');
  }

  const poolAddress = contractAddress(aavePool, request.parameters);
  const aTokenAddress = contractAddress(aToken, request.parameters);

  if (!poolAddress || !aTokenAddress) {
    return blockedResult(
      request,
      'INVALID_PARAMETERS',
      'Aave live-run requires resolved pool and aToken addresses.',
    );
  }

  const balance = await readBigInt(reader, erc20, token, 'balanceOf', [account]);

  if (balance < amount) {
    return blockedResult(
      request,
      'INSUFFICIENT_BALANCE',
      'Aave token balance is lower than amount.',
    );
  }

  const allowance = await readBigInt(reader, erc20, token, 'allowance', [account, poolAddress]);
  const transactions: LivePreparedTransaction[] = [];

  if (allowance < amount) {
    transactions.push(
      encodeTx(
        erc20,
        token,
        'approve',
        [poolAddress, amount],
        'erc20-approve',
        'Approve Aave Pool',
      ),
    );
  }

  transactions.push(
    encodeTx(
      aavePool,
      poolAddress,
      'supply',
      [token, amount, account, 0],
      'aave-supply',
      'Supply asset to Aave Pool',
    ),
  );

  return {
    ok: true,
    plan: {
      transactions,
      postChecks: [
        {
          name: 'aTokenBalance',
          call: readCall(aToken, aTokenAddress, 'balanceOf', [account]),
        },
      ],
    },
  };
}

async function createUniswapPlan(
  request: LiveExecutionRequest,
  account: Address,
  metadata: SepoliaTemplateMetadata,
  reader: LiveReadAdapter,
): Promise<{ ok: true; plan: LiveTemplatePlan } | LiveExecutionBlockedResult> {
  const erc20 = contractByName(metadata, 'ERC20');
  const router = contractByName(metadata, 'UniswapRouter');
  const tokenIn = addressParameter(request, 'tokenIn');
  const tokenOut = addressParameter(request, 'tokenOut');
  const amountIn = bigintParameter(request, 'amountIn');
  const amountOutMinimum = bigintParameter(request, 'amountOutMinimum');
  const feeTier = numberParameter(request, 'feeTier');

  if (!erc20 || !router || !tokenIn || !tokenOut || amountIn === undefined) {
    return blockedResult(
      request,
      'INVALID_PARAMETERS',
      'Uniswap live-run requires tokenIn, tokenOut, amountIn, amountOutMinimum, and feeTier.',
    );
  }

  if (amountOutMinimum === undefined || amountOutMinimum === 0n) {
    return blockedResult(
      request,
      'SLIPPAGE_POLICY_VIOLATION',
      'Uniswap live-run requires a non-zero amountOutMinimum.',
    );
  }

  if (feeTier === undefined) {
    return blockedResult(request, 'INVALID_PARAMETERS', 'Uniswap live-run requires feeTier.');
  }

  const routerAddress = contractAddress(router, request.parameters);

  if (!routerAddress) {
    return blockedResult(
      request,
      'INVALID_PARAMETERS',
      'Uniswap live-run requires resolved router address.',
    );
  }

  const balance = await readBigInt(reader, erc20, tokenIn, 'balanceOf', [account]);

  if (balance < amountIn) {
    return blockedResult(
      request,
      'INSUFFICIENT_BALANCE',
      'Uniswap tokenIn balance is lower than amountIn.',
    );
  }

  const allowance = await readBigInt(reader, erc20, tokenIn, 'allowance', [account, routerAddress]);
  const transactions: LivePreparedTransaction[] = [];

  if (allowance < amountIn) {
    transactions.push(
      encodeTx(
        erc20,
        tokenIn,
        'approve',
        [routerAddress, amountIn],
        'erc20-approve',
        'Approve Uniswap router',
      ),
    );
  }

  transactions.push(
    encodeTx(
      router,
      routerAddress,
      'exactInputSingle',
      [
        {
          tokenIn,
          tokenOut,
          fee: feeTier,
          recipient: account,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        },
      ],
      'uniswap-exact-input-single',
      'Swap tokenIn to tokenOut through Uniswap V3 SwapRouter02',
    ),
  );

  return {
    ok: true,
    plan: {
      transactions,
      postChecks: [
        {
          name: 'tokenOutBalance',
          call: readCall(erc20, tokenOut, 'balanceOf', [account]),
        },
      ],
    },
  };
}

async function createLidoPlan(
  request: LiveExecutionRequest,
  account: Address,
  metadata: SepoliaTemplateMetadata,
  reader: LiveReadAdapter,
): Promise<{ ok: true; plan: LiveTemplatePlan } | LiveExecutionBlockedResult> {
  const mockLido = contractByName(metadata, 'MockLido');
  const mockStEth = contractByName(metadata, 'MockStETH');
  const mockWstEth = contractByName(metadata, 'MockWstETH');
  const amount = bigintParameter(request, 'amount');

  if (!mockLido || !mockStEth || !mockWstEth || amount === undefined) {
    return blockedResult(request, 'INVALID_PARAMETERS', 'Lido mock live-run requires amount.');
  }

  const mockLidoAddress = contractAddress(mockLido, request.parameters);
  const mockStEthAddress = contractAddress(mockStEth, request.parameters);
  const mockWstEthAddress = contractAddress(mockWstEth, request.parameters);

  if (!mockLidoAddress || !mockStEthAddress || !mockWstEthAddress) {
    return blockedResult(
      request,
      'INVALID_PARAMETERS',
      'Lido mock live-run requires resolved mock addresses.',
    );
  }

  if (typeof reader.getNativeBalance !== 'function') {
    return blockedResult(
      request,
      'MISSING_READER',
      'Lido mock live-run requires reader.getNativeBalance for ETH preflight.',
    );
  }

  const nativeBalance = await reader.getNativeBalance(account);

  if (nativeBalance < amount) {
    return blockedResult(
      request,
      'INSUFFICIENT_BALANCE',
      'ETH balance is lower than Lido stake amount.',
    );
  }

  const allowance = await readBigInt(reader, mockStEth, mockStEthAddress, 'allowance', [
    account,
    mockWstEthAddress,
  ]);
  const transactions: LivePreparedTransaction[] = [
    encodeTx(
      mockLido,
      mockLidoAddress,
      'submit',
      [addressParameter(request, 'referral') ?? ZERO_ADDRESS],
      'lido-mock-submit',
      'Submit ETH to Sepolia MockLido',
      amount,
    ),
  ];

  if (allowance < amount) {
    transactions.push(
      encodeTx(
        mockStEth,
        mockStEthAddress,
        'approve',
        [mockWstEthAddress, amount],
        'steth-approve',
        'Approve MockWstETH to wrap MockStETH',
      ),
    );
  }

  transactions.push(
    encodeTx(
      mockWstEth,
      mockWstEthAddress,
      'wrap',
      [amount],
      'wsteth-wrap',
      'Wrap MockStETH into MockWstETH',
    ),
  );

  return {
    ok: true,
    plan: {
      transactions,
      postChecks: [
        {
          name: 'wstETHBalance',
          call: readCall(mockWstEth, mockWstEthAddress, 'balanceOf', [account]),
        },
      ],
    },
  };
}

function contractByName(
  metadata: SepoliaTemplateMetadata,
  contractName: string,
): SepoliaContractMetadata | undefined {
  return metadata.contracts.find((contract) => contract.contract === contractName);
}

function contractAddress(
  contract: SepoliaContractMetadata,
  parameters: Record<string, unknown>,
): Address | undefined {
  switch (contract.address.kind) {
    case 'protocol-address':
    case 'mock-address':
      return isAddressValue(contract.address.value) ? contract.address.value : undefined;
    case 'template-parameter': {
      const value = parameters[contract.address.parameter];
      return isAddressValue(value) ? value : undefined;
    }
    default:
      return undefined;
  }
}

function addressParameter(request: LiveExecutionRequest, name: string): Address | undefined {
  const value = request.parameters[name];
  return isAddressValue(value) ? value : undefined;
}

function bigintParameter(request: LiveExecutionRequest, name: string): bigint | undefined {
  const value = request.parameters[name];

  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value);
  }

  return undefined;
}

function numberParameter(request: LiveExecutionRequest, name: string): number | undefined {
  const value = request.parameters[name];

  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }

  return undefined;
}

function isAddressValue(value: unknown): value is Address {
  return typeof value === 'string' && isAddress(value);
}

function abiOf(contract: SepoliaContractMetadata): Abi {
  return contract.abi.fragments as unknown as Abi;
}

function encodeTx(
  contract: SepoliaContractMetadata,
  to: Address,
  functionName: string,
  args: readonly unknown[],
  step: string,
  description: string,
  value?: bigint,
): LivePreparedTransaction {
  return {
    step,
    to,
    data: encodeFunctionData({
      abi: abiOf(contract),
      functionName,
      args,
    }),
    value,
    description,
  };
}

function readCall(
  contract: SepoliaContractMetadata,
  address: Address,
  functionName: string,
  args: readonly unknown[],
): LiveReadContractInput {
  return {
    address,
    abi: abiOf(contract),
    functionName,
    args,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readBigInt(
  reader: LiveReadAdapter,
  contract: SepoliaContractMetadata,
  address: Address,
  functionName: string,
  args: readonly unknown[],
): Promise<bigint> {
  const value = await reader.readContract(readCall(contract, address, functionName, args));

  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value);
  }

  throw new Error(`${functionName} must return a bigint-compatible value.`);
}

export function runLiveExecutionGuardTests(): string[] {
  const passed: string[] = [];
  const wrongChain = evaluateLiveExecutionRequest({
    templateId: 'aave-recurring-deposit',
    chainId: 1,
    executionMode: LIVE_RUN,
    confirmLiveExecution: true,
    featureFlags: { [LIVE_EXECUTION_FEATURE_FLAG]: true },
    parameters: {},
  });

  if (wrongChain.ok || wrongChain.code !== 'UNSUPPORTED_CHAIN') {
    throw new Error('wrong chain must be rejected before signer checks');
  }
  passed.push('unsupported chain is rejected');

  const missingConfirmation = evaluateLiveExecutionRequest({
    templateId: 'aave-recurring-deposit',
    chainId: SEPOLIA_CHAIN_ID,
    executionMode: LIVE_RUN,
    confirmLiveExecution: false,
    featureFlags: { [LIVE_EXECUTION_FEATURE_FLAG]: true },
    parameters: {},
  });

  if (missingConfirmation.ok || missingConfirmation.code !== 'LIVE_CONFIRMATION_REQUIRED') {
    throw new Error('missing live confirmation must be rejected');
  }
  passed.push('missing live confirmation is rejected');

  return passed;
}
