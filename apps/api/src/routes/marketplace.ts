import { Hono } from 'hono';
import { z } from 'zod';

import { log } from '@/log';
import { marketplaceStore } from '@/marketplaceStore';
import { workflowStore } from '@/store';
import { zValidator } from '@/validate';

export const marketplaceRouter = new Hono();

// 워크플로우를 마켓에 게시할 때 받는 입력
// 워크플로우 자체는 workflowId로 참조 → 서버에서 스냅샷 떠서 listing에 임베드
const publishSchema = z.object({
  workflowId: z.string(),
  author: z.string(),
  tags: z.array(z.string()).default([]),
  pricing: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('free') }),
      z.object({
        type: z.literal('x402'),
        amount: z.string(),
        token: z.string(),
      }),
    ])
    .default({ type: 'free' }),
});

// 게시된 listing 목록 — tag/author 필터 + newest/popular 정렬 지원
marketplaceRouter.get('/', (c) => {
  const tag = c.req.query('tag');
  const author = c.req.query('author');
  const sort = c.req.query('sort') ?? 'newest';

  let items = marketplaceStore.list();
  if (tag) items = items.filter((l) => l.tags.includes(tag));
  if (author) items = items.filter((l) => l.author === author);
  if (sort === 'popular') {
    items = [...items].sort((a, b) => b.stats.runs - a.stats.runs);
  } else {
    items = [...items].sort((a, b) => b.createdAt - a.createdAt);
  }

  return c.json({ items, total: items.length });
});

// 단건 조회 — listing 정보 + 임베드된 워크플로우 함께 반환
marketplaceRouter.get('/:id', (c) => {
  const listing = marketplaceStore.get(c.req.param('id'));
  if (!listing) {
    return c.json({ error: 'listing not found' }, 404);
  }
  return c.json({ listing });
});

// 워크플로우를 마켓에 게시 — 우리 store에서 워크플로우 가져와서 listing에 스냅샷
marketplaceRouter.post('/', zValidator('json', publishSchema), (c) => {
  const { workflowId, author, tags, pricing } = c.req.valid('json');
  const workflow = workflowStore.get(workflowId);
  if (!workflow) {
    return c.json({ error: 'workflow not found' }, 404);
  }

  const listing = marketplaceStore.create({
    workflow,
    author,
    tags,
    pricing,
  });
  log('marketplace', 'published', {
    listingId: listing.id,
    workflowId,
    pricing: pricing.type,
    tags,
  });
  return c.json({ listing }, 201);
});

// 언퍼블리시 — listing 자체만 삭제, 원본 워크플로우는 그대로
marketplaceRouter.delete('/:id', (c) => {
  const id = c.req.param('id');
  const ok = marketplaceStore.delete(id);
  if (!ok) {
    return c.json({ error: 'listing not found' }, 404);
  }
  log('marketplace', 'unpublished', { listingId: id });
  return c.json({ deleted: true });
});
