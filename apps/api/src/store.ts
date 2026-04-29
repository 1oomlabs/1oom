import type { Workflow } from '@loomlabs/schema';
import type { Workflow as DbWorkflow, Prisma } from '@prisma/client';

import { prisma } from '@/db';

// 신규 생성 입력 — id/createdAt/status는 자동 채움
type CreateWorkflowInput = Omit<Workflow, 'id' | 'createdAt' | 'status'> & {
  status?: Workflow['status'];
};

// DB 컬럼 → API Workflow 변환
// 이유: DB는 표준 DateTime/null 사용, API 스펙은 Workflow type(epoch ms/undefined) 유지
function toWorkflow(row: DbWorkflow): Workflow {
  return {
    id: row.id,
    templateId: row.templateId,
    owner: row.owner,
    name: row.name,
    description: row.description ?? undefined,
    chainId: row.chainId,
    parameters: row.parameters as Workflow['parameters'],
    trigger: row.trigger as Workflow['trigger'],
    actions: row.actions as Workflow['actions'],
    status: row.status as Workflow['status'],
    keeperJobId: row.keeperJobId ?? undefined,
    createdAt: row.createdAt.getTime(),
  };
}

// 인메모리 Map → Prisma. 인터페이스는 그대로 유지(라우트 영향 최소화)
export const workflowStore = {
  async create(input: CreateWorkflowInput): Promise<Workflow> {
    // JSON 컬럼은 Prisma의 strict 타입(InputJsonValue)으로 cast 필요
    // (zod의 Record<string,unknown>은 직접 매칭 안 됨 — TS 타입 다름)
    const row = await prisma.workflow.create({
      data: {
        templateId: input.templateId,
        owner: input.owner,
        name: input.name,
        description: input.description,
        chainId: input.chainId,
        parameters: input.parameters as Prisma.InputJsonValue,
        trigger: input.trigger as Prisma.InputJsonValue,
        actions: input.actions as Prisma.InputJsonValue,
        status: input.status ?? 'draft',
        keeperJobId: input.keeperJobId,
      },
    });
    return toWorkflow(row);
  },

  async get(id: string): Promise<Workflow | undefined> {
    const row = await prisma.workflow.findUnique({ where: { id } });
    return row ? toWorkflow(row) : undefined;
  },

  async list(): Promise<Workflow[]> {
    const rows = await prisma.workflow.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toWorkflow);
  },

  // 부분 업데이트 — undefined 필드는 변경 안 함 (기존 in-memory 동작과 동일)
  async update(id: string, patch: Partial<Workflow>): Promise<Workflow | undefined> {
    // id/createdAt은 변경 불가 필드 → _ prefix로 빼서 무시 (실수로라도 update 안 되게)
    // JSON 필드는 따로 빼서 cast 필요, 나머지(string/number)는 ...rest로 그대로 전달 가능
    const { id: _id, createdAt: _createdAt, parameters, trigger, actions, ...rest } = patch;
    try {
      const row = await prisma.workflow.update({
        where: { id },
        data: {
          ...rest,
          // 조건부 spread — patch에 들어온 JSON 필드만 update data에 포함
          // (undefined 그대로 넘기면 Prisma가 null로 해석해서 컬럼 비울 수 있음)
          ...(parameters !== undefined && { parameters: parameters as Prisma.InputJsonValue }),
          ...(trigger !== undefined && { trigger: trigger as Prisma.InputJsonValue }),
          ...(actions !== undefined && { actions: actions as Prisma.InputJsonValue }),
        },
      });
      return toWorkflow(row);
    } catch {
      // Prisma update는 없는 id면 P2025 throw — 원본 in-memory는 undefined 반환했어서 동일하게 맞춤
      return undefined;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.workflow.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};
