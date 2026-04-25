import type { Template } from '@loomlabs/schema';

export const aaveRecurringDepositTemplate: Template = {
  id: 'aave-recurring-deposit',
  name: 'Aave Recurring Deposit',
  protocol: 'aave',
  category: 'yield',
  description: 'Periodically deposit a token into the Aave lending pool.',
  intentKeywords: ['aave', 'deposit', 'supply', 'recurring', 'yield', 'lend'],
  parameters: [
    { name: 'token', type: 'address', required: true, description: 'Token to deposit' },
    { name: 'amount', type: 'uint256', required: true, description: 'Amount per deposit' },
    { name: 'interval', type: 'duration', required: true, description: 'Interval (e.g. 7d)' },
    {
      name: 'maxIterations',
      type: 'number',
      required: false,
      description: 'Max repeats',
      default: 52,
    },
  ],
  trigger: { type: 'cron', expression: '@interval' },
  actions: [
    { contract: 'ERC20', method: 'approve', args: ['$AAVE_POOL', '$amount'] },
    { contract: 'AavePool', method: 'supply', args: ['$token', '$amount', '$user', '0'] },
  ],
};
