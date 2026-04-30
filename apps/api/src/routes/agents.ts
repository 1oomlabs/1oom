import { Hono } from 'hono';
import { z } from 'zod';

import { extractWorkflowIntent } from '@loomlabs/llm';

import { prisma } from '@/db';
import { log } from '@/log';
import { zValidator } from '@/validate';

export const agentsRouter = new Hono();

// intent 추출 요청 입력
const intentRequestSchema = z.object({
  message: z.string().min(1),
});

// 에이전트 카탈로그 — 정적 배열 → DB 조회로 전환
// 기본 에이전트(loomlabs)는 prisma/seed.ts로 시드, 추가 에이전트는 DB에 직접 insert
agentsRouter.get('/', async (c) => {
  const agents = await prisma.agent.findMany({ orderBy: { id: 'asc' } });
  return c.json({ agents });
});

// 단건 조회
agentsRouter.get('/:id', async (c) => {
  const agent = await prisma.agent.findUnique({ where: { id: c.req.param('id') } });
  if (!agent) {
    return c.json({ error: 'agent not found' }, 404);
  }
  return c.json({ agent });
});

// 자연어 메시지 → intent 추출 (에이전트 인터페이스로 LLM 노출)
// 실제 워크플로우 생성은 /api/workflows POST를 그대로 쓰면 됨 — 여기는 미리보기 용
agentsRouter.post('/:id/intent', zValidator('json', intentRequestSchema), async (c) => {
  const agent = await prisma.agent.findUnique({ where: { id: c.req.param('id') } });
  if (!agent) {
    return c.json({ error: 'agent not found' }, 404);
  }
  const { message } = c.req.valid('json');
  log('agents', 'intent requested', { agent: agent.id, message: message.slice(0, 60) });
  const intent = await extractWorkflowIntent({ prompt: message });
  log('agents', 'intent done', { templateId: intent.templateId });
  return c.json({ agent: agent.id, message, intent });
});
