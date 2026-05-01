export const SEPOLIA_CHAIN_ID = 11155111 as const;
export const NEEDS_HUMAN_CONFIRMATION = 'NEEDS_HUMAN_CONFIRMATION' as const;
export const HUMAN_CONFIRMED = 'HUMAN_CONFIRMED' as const;
export const DRY_RUN_ONLY = 'dry-run-only' as const;

export type SepoliaTemplateId = 'aave-recurring-deposit' | 'uniswap-dca' | 'lido-stake';
export type HumanConfirmationStatus = typeof NEEDS_HUMAN_CONFIRMATION;
export type HumanConfirmedStatus = typeof HUMAN_CONFIRMED;
export type ConfirmedTemplateSource = 'CONFIRMED_TEMPLATE_PARAMETER' | 'CONFIRMED_NATIVE_ASSET';
export type SepoliaAddress = `0x${string}`;

export type SepoliaAddressSource =
  | {
      kind: 'template-parameter';
      parameter: string;
      confirmation: ConfirmedTemplateSource;
    }
  | {
      kind: 'native-asset';
      asset: 'ETH';
      confirmation: ConfirmedTemplateSource;
    }
  | {
      kind: 'protocol-address';
      value: HumanConfirmationStatus;
      confirmation: HumanConfirmationStatus;
    }
  | {
      kind: 'protocol-address';
      value: SepoliaAddress;
      confirmation: HumanConfirmedStatus;
      source: string;
    }
  | {
      kind: 'mock-address';
      value: HumanConfirmationStatus;
      confirmation: HumanConfirmationStatus;
      mockContract: string;
    }
  | {
      kind: 'mock-address';
      value: SepoliaAddress;
      confirmation: HumanConfirmedStatus;
      source: string;
      mockContract: string;
    };

export type SepoliaAbiParameter = {
  internalType: string;
  name: string;
  type: string;
  components?: readonly SepoliaAbiParameter[];
};

export type SepoliaAbiFragment = {
  inputs: readonly SepoliaAbiParameter[];
  name: string;
  outputs: readonly SepoliaAbiParameter[];
  stateMutability: 'nonpayable' | 'payable' | 'pure' | 'view';
  type: 'function';
};

export type SepoliaAbiMetadata =
  | {
      status: HumanConfirmationStatus;
      fragments: readonly [];
      note: string;
    }
  | {
      status: HumanConfirmedStatus;
      fragments: readonly SepoliaAbiFragment[];
      note: string;
    };

export type SepoliaContractMetadata = {
  contract: string;
  address: SepoliaAddressSource;
  requiredMethods: readonly string[];
  abi: SepoliaAbiMetadata;
};

export type SepoliaDemoParameter = {
  name: string;
  value: string | number | boolean;
  label?: string;
  confirmation: HumanConfirmedStatus;
};

export type SepoliaRuntimePlaceholderValue = {
  placeholder: string;
  value: SepoliaAddress;
  confirmation: HumanConfirmedStatus;
  source: string;
};

export type SepoliaVerificationTarget = {
  name: string;
  value: SepoliaAddress;
  confirmation: HumanConfirmedStatus;
  note: string;
};

export type SepoliaLiquidityMetadata = {
  poolAddress: SepoliaAddress;
  hasLiquidity: true;
  confirmation: HumanConfirmedStatus;
  note: string;
};

export type SepoliaTemplateMetadata = {
  templateId: SepoliaTemplateId;
  chainId: typeof SEPOLIA_CHAIN_ID;
  network: 'sepolia';
  executionMode: typeof DRY_RUN_ONLY;
  demoOnly: true;
  requiresHumanConfirmation: boolean;
  contracts: readonly SepoliaContractMetadata[];
  runtimePlaceholders: readonly string[];
  runtimePlaceholderValues: readonly SepoliaRuntimePlaceholderValue[];
  demoParameters: readonly SepoliaDemoParameter[];
  verificationTargets: readonly SepoliaVerificationTarget[];
  liquidity?: SepoliaLiquidityMetadata;
  unresolvedHumanConfirmations: readonly string[];
  unsupportedOperations: readonly string[];
};

const protocolAddress = (value: SepoliaAddress, source: string): SepoliaAddressSource => ({
  kind: 'protocol-address',
  value,
  confirmation: HUMAN_CONFIRMED,
  source,
});

const unconfirmedProtocolAddress = (): SepoliaAddressSource => ({
  kind: 'protocol-address',
  value: NEEDS_HUMAN_CONFIRMATION,
  confirmation: NEEDS_HUMAN_CONFIRMATION,
});

const mockAddress = (
  value: SepoliaAddress,
  source: string,
  mockContract: string,
): SepoliaAddressSource => ({
  kind: 'mock-address',
  value,
  confirmation: HUMAN_CONFIRMED,
  source,
  mockContract,
});

const confirmedAbi = (
  fragments: readonly SepoliaAbiFragment[],
  note: string,
): SepoliaAbiMetadata => ({
  status: HUMAN_CONFIRMED,
  fragments,
  note,
});

const unconfirmedAbi = (note: string): SepoliaAbiMetadata => ({
  status: NEEDS_HUMAN_CONFIRMATION,
  fragments: [],
  note,
});

const erc20AbiFragments = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const satisfies readonly SepoliaAbiFragment[];

const aaveSupplyAbiFragments = [
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'onBehalfOf', type: 'address' },
      { internalType: 'uint16', name: 'referralCode', type: 'uint16' },
    ],
    name: 'supply',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const satisfies readonly SepoliaAbiFragment[];

const uniswapExactInputSingleAbiFragments = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IV3SwapRouter.ExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const satisfies readonly SepoliaAbiFragment[];

const mockLidoAbiFragments = [
  {
    inputs: [{ internalType: 'address', name: 'referral', type: 'address' }],
    name: 'submit',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const satisfies readonly SepoliaAbiFragment[];

const mockWstEthAbiFragments = [
  {
    inputs: [{ internalType: 'uint256', name: 'stETHAmount', type: 'uint256' }],
    name: 'wrap',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'wstETHAmount', type: 'uint256' }],
    name: 'unwrap',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  ...erc20AbiFragments,
] as const satisfies readonly SepoliaAbiFragment[];

export const sepoliaTemplateMetadata = {
  'aave-recurring-deposit': {
    templateId: 'aave-recurring-deposit',
    chainId: SEPOLIA_CHAIN_ID,
    network: 'sepolia',
    executionMode: DRY_RUN_ONLY,
    demoOnly: true,
    requiresHumanConfirmation: false,
    contracts: [
      {
        contract: 'ERC20',
        address: {
          kind: 'template-parameter',
          parameter: 'token',
          confirmation: 'CONFIRMED_TEMPLATE_PARAMETER',
        },
        requiredMethods: ['approve', 'allowance', 'balanceOf', 'decimals', 'symbol'],
        abi: confirmedAbi(erc20AbiFragments, 'ERC20 ABI fragment confirmed by human review.'),
      },
      {
        contract: 'AavePool',
        address: protocolAddress(
          '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
          'AaveV3Sepolia.POOL',
        ),
        requiredMethods: ['supply'],
        abi: confirmedAbi(
          aaveSupplyAbiFragments,
          'Aave Pool supply ABI confirmed by human review.',
        ),
      },
      {
        contract: 'AaveAToken',
        address: protocolAddress(
          '0x3FfAf50D4F4E96eB78f2407c090b72e86eCaed24',
          'AaveV3SepoliaAssets.LINK_A_TOKEN',
        ),
        requiredMethods: ['balanceOf'],
        abi: confirmedAbi(
          erc20AbiFragments,
          'aLINK balanceOf uses the confirmed ERC20 ABI fragment.',
        ),
      },
    ],
    runtimePlaceholders: ['$AAVE_POOL', '$user'],
    runtimePlaceholderValues: [
      {
        placeholder: '$AAVE_POOL',
        value: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
        confirmation: HUMAN_CONFIRMED,
        source: 'AaveV3Sepolia.POOL',
      },
    ],
    demoParameters: [
      {
        name: 'token',
        label: 'LINK',
        value: '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5',
        confirmation: HUMAN_CONFIRMED,
      },
      { name: 'tokenDecimals', label: 'LINK decimals', value: 18, confirmation: HUMAN_CONFIRMED },
    ],
    verificationTargets: [
      {
        name: 'aToken',
        value: '0x3FfAf50D4F4E96eB78f2407c090b72e86eCaed24',
        confirmation: HUMAN_CONFIRMED,
        note: 'Use aLINK balanceOf for post-supply verification in non-dry-run environments.',
      },
    ],
    unresolvedHumanConfirmations: [],
    unsupportedOperations: [
      'rpc-call',
      'signer-required',
      'transaction-construction',
      'real-transaction-execution',
    ],
  },
  'uniswap-dca': {
    templateId: 'uniswap-dca',
    chainId: SEPOLIA_CHAIN_ID,
    network: 'sepolia',
    executionMode: DRY_RUN_ONLY,
    demoOnly: true,
    requiresHumanConfirmation: false,
    contracts: [
      {
        contract: 'ERC20',
        address: {
          kind: 'template-parameter',
          parameter: 'tokenIn',
          confirmation: 'CONFIRMED_TEMPLATE_PARAMETER',
        },
        requiredMethods: ['approve', 'allowance', 'balanceOf', 'decimals', 'symbol'],
        abi: confirmedAbi(erc20AbiFragments, 'ERC20 ABI fragment confirmed by human review.'),
      },
      {
        contract: 'UniswapRouter',
        address: protocolAddress(
          '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
          'Uniswap V3 Sepolia SwapRouter02 deployment',
        ),
        requiredMethods: ['exactInputSingle'],
        abi: confirmedAbi(
          uniswapExactInputSingleAbiFragments,
          'SwapRouter02 exactInputSingle ABI confirmed by human review.',
        ),
      },
    ],
    runtimePlaceholders: ['$UNISWAP_ROUTER', '$user'],
    runtimePlaceholderValues: [
      {
        placeholder: '$UNISWAP_ROUTER',
        value: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
        confirmation: HUMAN_CONFIRMED,
        source: 'Uniswap V3 Sepolia SwapRouter02 deployment',
      },
    ],
    demoParameters: [
      {
        name: 'tokenIn',
        label: 'USDC',
        value: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        confirmation: HUMAN_CONFIRMED,
      },
      { name: 'tokenInDecimals', label: 'USDC decimals', value: 6, confirmation: HUMAN_CONFIRMED },
      {
        name: 'tokenOut',
        label: 'WETH',
        value: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
        confirmation: HUMAN_CONFIRMED,
      },
      {
        name: 'tokenOutDecimals',
        label: 'WETH decimals',
        value: 18,
        confirmation: HUMAN_CONFIRMED,
      },
      { name: 'feeTier', label: 'USDC/WETH 0.05%', value: 500, confirmation: HUMAN_CONFIRMED },
      {
        name: 'poolAddress',
        label: 'USDC/WETH 0.05% pool',
        value: '0x3289680dd4d6c10bb19b899729cda5eef58aeff1',
        confirmation: HUMAN_CONFIRMED,
      },
      { name: 'poolHasLiquidity', value: true, confirmation: HUMAN_CONFIRMED },
    ],
    verificationTargets: [],
    liquidity: {
      poolAddress: '0x3289680dd4d6c10bb19b899729cda5eef58aeff1',
      hasLiquidity: true,
      confirmation: HUMAN_CONFIRMED,
      note: 'Human-confirmed USDC/WETH 0.05% Sepolia pool with meaningful liquidity.',
    },
    unresolvedHumanConfirmations: [],
    unsupportedOperations: [
      'rpc-call',
      'signer-required',
      'transaction-construction',
      'real-transaction-execution',
    ],
  },
  'lido-stake': {
    templateId: 'lido-stake',
    chainId: SEPOLIA_CHAIN_ID,
    network: 'sepolia',
    executionMode: DRY_RUN_ONLY,
    demoOnly: true,
    requiresHumanConfirmation: false,
    contracts: [
      {
        contract: 'MockLido',
        address: mockAddress(
          '0x800AB7B237F8Bf9639c0E9127756a5b9049D0C73',
          'Human-provided Sepolia MockLido deployment',
          'MockLido',
        ),
        requiredMethods: ['submit'],
        abi: confirmedAbi(
          mockLidoAbiFragments,
          'MockLido submit ABI is confirmed for dry-run demo metadata only.',
        ),
      },
      {
        contract: 'MockStETH',
        address: mockAddress(
          '0xE1264e5AADb69A27bE594aaafc502D654FFbaC97',
          'Human-provided Sepolia MockStETH deployment',
          'MockStETH',
        ),
        requiredMethods: ['balanceOf', 'approve', 'allowance', 'decimals', 'symbol'],
        abi: confirmedAbi(
          erc20AbiFragments,
          'MockStETH uses the confirmed ERC20 ABI fragment for dry-run demo metadata only.',
        ),
      },
      {
        contract: 'MockWstETH',
        address: mockAddress(
          '0xc4936b9baA6E09a5Aa39dCE7001d24aAE84E97fF',
          'Human-provided Sepolia MockWstETH deployment',
          'MockWstETH',
        ),
        requiredMethods: ['wrap', 'unwrap', 'balanceOf', 'decimals', 'symbol'],
        abi: confirmedAbi(
          mockWstEthAbiFragments,
          'MockWstETH wrap/unwrap ABI is confirmed for dry-run demo metadata only.',
        ),
      },
    ],
    runtimePlaceholders: ['$MOCK_WSTETH'],
    runtimePlaceholderValues: [
      {
        placeholder: '$MOCK_WSTETH',
        value: '0xc4936b9baA6E09a5Aa39dCE7001d24aAE84E97fF',
        confirmation: HUMAN_CONFIRMED,
        source: 'Human-provided Sepolia MockWstETH deployment',
      },
    ],
    demoParameters: [
      {
        name: 'stETHDecimals',
        label: 'Mock stETH decimals',
        value: 18,
        confirmation: HUMAN_CONFIRMED,
      },
      {
        name: 'wstETHDecimals',
        label: 'Mock wstETH decimals',
        value: 18,
        confirmation: HUMAN_CONFIRMED,
      },
      {
        name: 'mockExchangeRate',
        label: 'Mock stETH/wstETH conversion',
        value: '1:1',
        confirmation: HUMAN_CONFIRMED,
      },
    ],
    verificationTargets: [],
    unresolvedHumanConfirmations: [],
    unsupportedOperations: [
      'rpc-call',
      'signer-required',
      'transaction-construction',
      'real-transaction-execution',
      'contract-deployment',
    ],
  },
} as const satisfies Record<SepoliaTemplateId, SepoliaTemplateMetadata>;

export function getSepoliaTemplateMetadata(
  templateId: string,
): SepoliaTemplateMetadata | undefined {
  return sepoliaTemplateMetadata[templateId as SepoliaTemplateId];
}
