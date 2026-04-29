import { mainnet, sepolia } from 'wagmi/chains';

export const SUPPORTED_CHAINS = [
  { id: sepolia.id, label: 'Sepolia' },
  { id: mainnet.id, label: 'Ethereum' },
] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]['id'];

export function chainLabel(id?: number): string {
  return SUPPORTED_CHAINS.find((c) => c.id === id)?.label ?? `Chain ${id ?? '?'}`;
}

export const DEFAULT_PUBLISH_PRICING = { type: 'free' } as const;

export const ADDRESS_PREFIX_LEN = 6;
export const ADDRESS_SUFFIX_LEN = 4;

export function shortenAddress(addr: string): string {
  if (addr.length <= ADDRESS_PREFIX_LEN + ADDRESS_SUFFIX_LEN + 2) return addr;
  return `${addr.slice(0, ADDRESS_PREFIX_LEN)}…${addr.slice(-ADDRESS_SUFFIX_LEN)}`;
}

export const COPIED_RESET_MS = 1200;
export const TOAST_DEFAULT_DURATION_MS = 4000;

export const CURRENT_AGENT_ID = 'loomlabs';
