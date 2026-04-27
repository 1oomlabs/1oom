import { Hono } from 'hono';
import { z } from 'zod';

import { extractWorkflowIntent } from '@loomlabs/llm';

import { log } from '@/log';
import { zValidator } from '@/validate';

export const agentsRouter = new Hono();

// 데모용 에이전트 카탈로그 — 지금은 loomlabs 1개
// C의 ElizaOS 통합 별도, 여기는 B 단독으로 LLM 직접 호출
const agents = [
  {
    id: 'loomlabs',
    name: 'Loomlabs Agent',
    description: 'Turns natural language into DeFi workflows on KeeperHub.',
    actions: ['CREATE_WORKFLOW_INTENT'],
  },
];

// intent 추출 요청 입력
const intentRequestSchema = z.object({
  message: z.string().min(1),
});

// 에이전트 리스트
agentsRouter.get('/', (c) => {
  return c.json({ agents });
});

// 단건 조회
agentsRouter.get('/:id', (c) => {
  const agent = agents.find((a) => a.id === c.req.param('id'));
  if (!agent) {
    return c.json({ error: 'agent not found' }, 404);
  }
  return c.json({ agent });
});

// 자연어 메시지 → intent 추출 (에이전트 인터페이스로 LLM 노출)
// 실제 워크플로우 생성은 /api/workflows POST를 그대로 쓰면 됨 — 여기는 미리보기 용
agentsRouter.post('/:id/intent', zValidator('json', intentRequestSchema), async (c) => {
  const agent = agents.find((a) => a.id === c.req.param('id'));
  if (!agent) {
    return c.json({ error: 'agent not found' }, 404);
  }
  const { message } = c.req.valid('json');
  log('agents', 'intent requested', { agent: agent.id, message: message.slice(0, 60) });
  const intent = await extractWorkflowIntent({ prompt: message });
  log('agents', 'intent done', { templateId: intent.templateId });
  return c.json({ agent: agent.id, message, intent });
});
