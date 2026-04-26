import type { WorkflowCardData } from '@/components/ui/workflow-card';

export const mockWorkflows: WorkflowCardData[] = [
  {
    id: 'aave-recurring-deposit',
    name: 'Friday USDC into Aave',
    description:
      'Every Friday at 18:00 UTC, deposit 100 USDC into the Aave v3 USDC pool on Ethereum mainnet.',
    protocol: 'aave',
    author: '0x7a2f4dCeAA9bE5e1a5BaC8E03cAC8e3D6e7fA3c1',
    price: 'free',
    installs: 1284,
    runs: 18420,
  },
  {
    id: 'uniswap-dca-eth',
    name: 'Weekly ETH DCA',
    description:
      'Dollar-cost-average $200 USDC into ETH on Uniswap v3 every Monday morning. 50bps slippage cap.',
    protocol: 'uniswap',
    author: '0xCAF1239CdEA3a8E9CF17e9d0A6c1A92BAF89A011',
    price: { amount: '0.5', token: 'USDC' },
    installs: 962,
    runs: 7421,
  },
  {
    id: 'lido-stake-quarterly',
    name: 'Quarterly ETH stake → Lido',
    description:
      'Stake the first 0.5 ETH of each quarter into Lido, auto-compound stETH yield monthly.',
    protocol: 'lido',
    author: '0x9D14eC1183f1b3F12a7c5cD4fE8e9b3aB12c89D3',
    price: 'free',
    installs: 411,
    runs: 1230,
  },
  {
    id: 'aave-deleverage-guard',
    name: 'Aave health-factor guard',
    description:
      'Monitor Aave borrow position. If HF drops below 1.25, auto-repay 20% of debt to keep things safe.',
    protocol: 'aave',
    author: '0x32a1bE91FaA4eB0e1A06d1c5DC91b4eD7E2a55cA',
    price: { amount: '2.0', token: 'USDC' },
    installs: 287,
    runs: 612,
  },
  {
    id: 'uniswap-limit-order-eth',
    name: 'ETH limit buy at $1,800',
    description:
      'Watch ETH/USDC price. When ETH falls below $1,800, swap 1,000 USDC into ETH on Uniswap v3.',
    protocol: 'uniswap',
    author: '0x7a2f4dCeAA9bE5e1a5BaC8E03cAC8e3D6e7fA3c1',
    price: { amount: '1.0', token: 'USDC' },
    installs: 1531,
    runs: 942,
  },
  {
    id: 'aave-yield-rotator',
    name: 'Aave yield rotator',
    description:
      'Compare Aave USDC vs DAI APY weekly. Rotate the position to whichever pool yields more.',
    protocol: 'aave',
    author: '0xBeE1e23a08F4E3a17F2CdFBce0d0dE83bA89fD41',
    price: { amount: '5.0', token: 'USDC' },
    installs: 92,
    runs: 318,
  },
];

export const promptExamples = [
  'Every Friday, deposit 100 USDC into Aave',
  'Buy 0.05 ETH each Monday with USDC on Uniswap',
  'Stake 1 ETH into Lido and compound stETH monthly',
];

export const mockAgent = {
  id: 'alice',
  name: 'Alice',
  handle: 'alice.eth',
  bio: 'DeFi automation builder. Publishing free, audited workflows for Aave, Uniswap, and Lido.',
  joined: '2026-02-12',
  address: '0x7a2f4dCeAA9bE5e1a5BaC8E03cAC8e3D6e7fA3c1',
  stats: {
    published: 12,
    installs: 4218,
    runs: 31204,
  },
};

export const workflowDetail = {
  id: 'aave-recurring-deposit',
  name: 'Friday USDC into Aave',
  status: 'active' as 'active' | 'paused' | 'error',
  protocol: 'aave' as const,
  chainId: 1,
  trigger: 'cron · every Friday at 18:00 UTC',
  parameters: {
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    amount: '100000000', // 100 USDC (6 decimals)
    interval: '7d',
    maxIterations: 52,
  },
  recentRuns: [
    {
      id: 'run-0042',
      ranAt: '2026-04-25T18:00:14Z',
      status: 'success' as const,
      txHash: '0xab12cd34ef56789012345678901234567890abcdef1234567890abcdef123456',
      gasUsd: '1.42',
    },
    {
      id: 'run-0041',
      ranAt: '2026-04-18T18:00:08Z',
      status: 'success' as const,
      txHash: '0xcd34ef56ab789012345678901234567890abcdef1234567890abcdef12345612',
      gasUsd: '1.09',
    },
    {
      id: 'run-0040',
      ranAt: '2026-04-11T18:01:24Z',
      status: 'failure' as const,
      txHash: '0xef56ab12cd789012345678901234567890abcdef1234567890abcdef12345634',
      gasUsd: '0.41',
    },
  ],
};

export const marketplaceStats = [
  {
    label: 'Workflows',
    value: '128',
    delta: { value: '+12', trend: 'up' as const },
    hint: 'this week',
  },
  { label: 'Agents', value: '47', delta: { value: '+3', trend: 'up' as const }, hint: 'active' },
  {
    label: 'Total runs',
    value: '184k',
    delta: { value: '+9.2%', trend: 'up' as const },
    hint: '7d',
  },
  { label: 'TVL routed', value: '$2.4M', delta: { value: '–', trend: 'flat' as const } },
];
