import { randomUUID } from 'node:crypto';
import type { MarketplaceListing } from '@loomlabs/schema';

const listings = new Map<string, MarketplaceListing>();

// 새 게시 입력 타입 — id/createdAt/stats는 자동 채움
type CreateListingInput = Omit<MarketplaceListing, 'id' | 'createdAt' | 'stats'> & {
  stats?: MarketplaceListing['stats'];
};

export const marketplaceStore = {
  create(input: CreateListingInput): MarketplaceListing {
    const listing: MarketplaceListing = {
      ...input,
      id: randomUUID(),
      createdAt: Date.now(),
      stats: input.stats ?? { installs: 0, runs: 0 },
    };
    listings.set(listing.id, listing);
    return listing;
  },

  get(id: string): MarketplaceListing | undefined {
    return listings.get(id);
  },

  list(): MarketplaceListing[] {
    return Array.from(listings.values());
  },

  delete(id: string): boolean {
    return listings.delete(id);
  },

  // 데모용 — install/run 통계 증가
  incrementStat(id: string, key: 'installs' | 'runs'): MarketplaceListing | undefined {
    const existing = listings.get(id);
    if (!existing) return undefined;
    const updated: MarketplaceListing = {
      ...existing,
      stats: { ...existing.stats, [key]: existing.stats[key] + 1 },
    };
    listings.set(id, updated);
    return updated;
  },
};
