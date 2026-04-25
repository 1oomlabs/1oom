import type { Template } from '@loomlabs/schema';

export const lidoStakeTemplate: Template = {
  id: 'lido-stake',
  name: 'Lido ETH Stake',
  protocol: 'lido',
  category: 'staking',
  description: 'Stake ETH into Lido and receive stETH.',
  intentKeywords: ['lido', 'stake', 'eth', 'steth', 'stake eth'],
  parameters: [
    { name: 'amount', type: 'uint256', required: true, description: 'ETH amount (wei)' },
  ],
  trigger: { type: 'cron', expression: '@once' },
  actions: [
    { contract: 'Lido', method: 'submit', args: ['0x0000000000000000000000000000000000000000'] },
  ],
};
