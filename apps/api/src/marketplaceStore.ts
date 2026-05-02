import type { MarketplaceListing } from '@loomlabs/schema';
import type { MarketplaceListing as DbListing, Prisma } from '@prisma/client';

import { prisma } from '@/db';

// 신규 게시 입력 — id/createdAt/stats는 자동 채움
type CreateListingInput = Omit<MarketplaceListing, 'id' | 'createdAt' | 'stats'> & {
  stats?: MarketplaceListing['stats'];
};

// DB 컬럼 → API MarketplaceListing 변환
// 이유: store.ts와 동일하게 DB는 DateTime, API는 epoch ms 유지
function toListing(row: DbListing): MarketplaceListing {
  return {
    id: row.id,
    workflow: row.workflow as MarketplaceListing['workflow'],
    author: row.author,
    tags: row.tags,
    pricing: row.pricing as MarketplaceListing['pricing'],
    stats: row.stats as MarketplaceListing['stats'],
    createdAt: row.createdAt.getTime(),
  };
}

// 인메모리 Map → Prisma. 인터페이스는 그대로 유지(라우트 영향 최소화)
export const marketplaceStore = {
  async create(input: CreateListingInput): Promise<MarketplaceListing> {
    const row = await prisma.marketplaceListing.create({
      data: {
        workflow: input.workflow as Prisma.InputJsonValue,
        author: input.author,
        tags: input.tags,
        pricing: input.pricing as Prisma.InputJsonValue,
        stats: (input.stats ?? { installs: 0, runs: 0 }) as Prisma.InputJsonValue,
      },
    });
    return toListing(row);
  },

  async get(id: string): Promise<MarketplaceListing | undefined> {
    const row = await prisma.marketplaceListing.findUnique({ where: { id } });
    return row ? toListing(row) : undefined;
  },

  async list(): Promise<MarketplaceListing[]> {
    const rows = await prisma.marketplaceListing.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toListing);
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.marketplaceListing.delete({ where: { id } });
      return true;
    } catch {
      // 없는 id면 P2025 throw — 원본 in-memory가 false 반환했어서 동일하게 맞춤
      return false;
    }
  },

  // 데모용 — install/run 통계 1 증가
  // JSON 컬럼이라 atomic increment 불가, 읽고-쓰기 (race condition은 데모 규모에선 무시)
  async incrementStat(
    id: string,
    key: 'installs' | 'runs',
  ): Promise<MarketplaceListing | undefined> {
    const existing = await prisma.marketplaceListing.findUnique({ where: { id } });
    if (!existing) return undefined;
    const current = existing.stats as MarketplaceListing['stats'];
    const updated = await prisma.marketplaceListing.update({
      where: { id },
      data: {
        stats: { ...current, [key]: current[key] + 1 } as Prisma.InputJsonValue,
      },
    });
    return toListing(updated);
  },

  // workflow.id로 매칭되는 listing(들)의 stats.runs를 1씩 증가.
  // 같은 워크플로우가 여러 listing에 임베드된 경우 모두 갱신 (실무상 1:1 이지만 정합성 위해 다중 처리).
  async incrementRunsByWorkflowId(workflowId: string): Promise<number> {
    const matches = await prisma.marketplaceListing.findMany({
      where: { workflow: { path: ['id'], equals: workflowId } },
    });
    if (matches.length === 0) return 0;
    let bumped = 0;
    for (const row of matches) {
      const current = row.stats as MarketplaceListing['stats'];
      await prisma.marketplaceListing.update({
        where: { id: row.id },
        data: {
          stats: { ...current, runs: current.runs + 1 } as Prisma.InputJsonValue,
        },
      });
      bumped += 1;
    }
    return bumped;
  },

  async confirmOnchain(
    id: string,
    patch: { registryListingId?: number; confirmedAt?: number },
  ): Promise<MarketplaceListing | undefined> {
    const existing = await prisma.marketplaceListing.findUnique({ where: { id } });
    if (!existing) return undefined;

    const current = existing.stats as MarketplaceListing['stats'];
    if (!current?.onchain) return undefined;

    const nextStats: MarketplaceListing['stats'] = {
      installs: current.installs,
      runs: current.runs,
      onchain: {
        ...current.onchain,
        status: 'confirmed',
        registryListingId: patch.registryListingId ?? current.onchain.registryListingId,
        confirmedAt: patch.confirmedAt ?? Date.now(),
      },
    };

    const updated = await prisma.marketplaceListing.update({
      where: { id },
      data: { stats: nextStats as Prisma.InputJsonValue },
    });
    return toListing(updated);
  },
};
