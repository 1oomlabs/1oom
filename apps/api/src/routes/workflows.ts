import { Hono } from 'hono';

import { extractWorkflowIntent } from '@loomlabs/llm';
import { createWorkflowRequestSchema } from '@loomlabs/schema';

import { getKeeperHubClient } from '@/keeperhub';
import { log } from '@/log';
import { compileWorkflow } from '@/services/compile';
import { workflowStore } from '@/store';
import { zValidator } from '@/validate';

export const workflowsRouter = new Hono();

// 자연어로 워크플로우 만들기 — ETHGlobal 약속 #3 lifecycle 완성
// 흐름: prompt → LLM intent → 템플릿 조립 → 메모리 저장 → KeeperHub 등록 → 상태 갱신
workflowsRouter.post('/', zValidator('json', createWorkflowRequestSchema), async (c) => {
  const { prompt, owner, chainId } = c.req.valid('json');
  log('workflows', '▶ request received', {
    prompt: prompt.slice(0, 60),
    owner: `${owner.slice(0, 8)}...`,
    chainId,
  });

  const intent = await extractWorkflowIntent({ prompt });
  log('llm', 'intent extracted', {
    templateId: intent.templateId,
    confidence: intent.confidence,
  });

  const compiled = compileWorkflow({ intent, prompt, owner, chainId });
  log('compile', 'assembled workflow', { name: compiled.name });

  const draft = await workflowStore.create(compiled);
  log('store', 'saved as draft', { id: draft.id });

  const { keeperJobId } = await getKeeperHubClient().deployWorkflow(draft);
  log('keeperhub', 'deployed', { keeperJobId });

  const deployed = await workflowStore.update(draft.id, {
    keeperJobId,
    status: 'deployed',
  });
  log('workflows', '✓ lifecycle complete', {
    workflowId: draft.id,
    status: 'deployed',
  });

  return c.json({ workflow: deployed ?? draft, intent }, 201);
});

// 전체 목록 조회 — 데모용 단순 리스트 반환
workflowsRouter.get('/', async (c) => {
  return c.json({ workflows: await workflowStore.list() });
});

// 단건 조회 — 없으면 404
workflowsRouter.get('/:id', async (c) => {
  const workflow = await workflowStore.get(c.req.param('id'));
  if (!workflow) {
    return c.json({ error: 'workflow not found' }, 404);
  }
  return c.json({ workflow });
});

// "Run now" — KeeperHub에 즉시 실행 트리거
// keeperJobId 없으면 (= deploy 안 된 워크플로우) 409로 거부
workflowsRouter.post('/:id/run', async (c) => {
  const workflow = await workflowStore.get(c.req.param('id'));
  if (!workflow) {
    return c.json({ error: 'workflow not found' }, 404);
  }
  if (!workflow.keeperJobId) {
    return c.json({ error: 'workflow not deployed yet' }, 409);
  }
  log('workflows', '▶ run requested', {
    id: workflow.id,
    name: workflow.name,
    templateId: workflow.templateId,
    keeperJobId: workflow.keeperJobId,
  });
  const execution = await getKeeperHubClient().executeWorkflow(workflow.keeperJobId);
  log('keeperhub', 'execution triggered', execution);
  return c.json({ workflow, execution });
});

// 일시정지 — KeeperHub native 없음, 우리 store status만 'paused'로 마킹
// (KeeperHub job은 그대로 살아있지만 사용자 가시 상태는 paused)
workflowsRouter.post('/:id/pause', async (c) => {
  const workflow = await workflowStore.get(c.req.param('id'));
  if (!workflow) {
    return c.json({ error: 'workflow not found' }, 404);
  }
  if (workflow.keeperJobId) {
    await getKeeperHubClient().pauseJob(workflow.keeperJobId);
  }
  const updated = await workflowStore.update(workflow.id, { status: 'paused' });
  log('workflows', 'paused', {
    id: workflow.id,
    name: workflow.name,
    templateId: workflow.templateId,
    prev: workflow.status,
    now: 'paused',
  });
  return c.json({ workflow: updated ?? workflow });
});

// 재개 — pause의 반대. status를 'deployed'로 복귀
workflowsRouter.post('/:id/resume', async (c) => {
  const workflow = await workflowStore.get(c.req.param('id'));
  if (!workflow) {
    return c.json({ error: 'workflow not found' }, 404);
  }
  if (workflow.keeperJobId) {
    await getKeeperHubClient().resumeJob(workflow.keeperJobId);
  }
  const updated = await workflowStore.update(workflow.id, { status: 'deployed' });
  log('workflows', 'resumed', {
    id: workflow.id,
    name: workflow.name,
    templateId: workflow.templateId,
    prev: workflow.status,
    now: 'deployed',
  });
  return c.json({ workflow: updated ?? workflow });
});

// 복제 — 같은 파라미터로 새 워크플로우 만들고 KeeperHub에도 새로 등록
// 새 id, 새 keeperJobId 받아서 독립적으로 동작
workflowsRouter.post('/:id/fork', async (c) => {
  const original = await workflowStore.get(c.req.param('id'));
  if (!original) {
    return c.json({ error: 'workflow not found' }, 404);
  }

  // 원본의 store 관리 필드 빼고 동일한 정의로 새로 생성
  const draft = await workflowStore.create({
    templateId: original.templateId,
    owner: original.owner,
    name: `${original.name} (fork)`,
    description: original.description,
    chainId: original.chainId,
    parameters: original.parameters,
    trigger: original.trigger,
    actions: original.actions,
  });

  log('workflows', '▶ fork requested', {
    from: original.id,
    name: original.name,
    templateId: original.templateId,
  });
  const { keeperJobId } = await getKeeperHubClient().deployWorkflow(draft);
  const deployed = await workflowStore.update(draft.id, {
    keeperJobId,
    status: 'deployed',
  });
  log('workflows', '✓ forked', {
    newId: draft.id,
    newName: draft.name,
    keeperJobId,
  });

  return c.json({ workflow: deployed ?? draft, forkedFrom: original.id }, 201);
});

// 삭제 — 우리 store에서만 제거
// KeeperHub 측 워크플로우는 일단 살려둠 (데모 안정성, 청소는 수동 또는 나중에)
workflowsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const before = await workflowStore.get(id);
  const ok = await workflowStore.delete(id);
  if (!ok) {
    return c.json({ error: 'workflow not found' }, 404);
  }
  log('workflows', 'deleted', {
    id,
    name: before?.name,
    templateId: before?.templateId,
  });
  return c.json({ deleted: true });
});
