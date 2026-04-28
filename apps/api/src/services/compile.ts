import type { z } from 'zod';

import type { Intent } from '@loomlabs/llm';
import { workflowSchema } from '@loomlabs/schema';
import { getTemplateById } from '@loomlabs/templates';

// 필드 4개를 빼두고 나머지만 검증
// 빠진 것들: id/생성시각/상태(저장할 때 채움), keeperJobId(KeeperHub 등록 후 채움)
const compiledWorkflowSchema = workflowSchema.omit({
  id: true,
  createdAt: true,
  status: true,
  keeperJobId: true,
});
export type CompiledWorkflow = z.infer<typeof compiledWorkflowSchema>;

export type CompileWorkflowInput = {
  intent: Intent;
  prompt: string;
  owner: string;
  chainId: number;
};

// LLM이 뽑아낸 intent를 진짜 실행 가능한 워크플로우 모양으로 조립
// 흐름: 자연어 → intent → compile.ts → 메모리에 저장 → KeeperHub에 등록
export function compileWorkflow(input: CompileWorkflowInput): CompiledWorkflow {
  const template = getTemplateById(input.intent.templateId);
  if (!template) {
    // LLM이 없는 템플릿 이름을 지어낸 경우 여기서 바로 막음
    // 그냥 통과시키면 나중 단계에서 더 알아보기 힘든 에러로 터짐
    throw new Error(`Template not found: ${input.intent.templateId}`);
  }

  // 파라미터 채우는 순서: LLM이 준 값 → 템플릿 기본값 → 그래도 없는데 필수면 에러
  const parameters: Record<string, unknown> = {};
  for (const def of template.parameters) {
    if (def.name in input.intent.parameters) {
      parameters[def.name] = input.intent.parameters[def.name];
    } else if (def.default !== undefined) {
      parameters[def.name] = def.default;
    } else if (def.required) {
      throw new Error(`Required parameter "${def.name}" missing for template "${template.id}"`);
    }
  }

  // 워크플로우 이름은 사용자가 입력한 문장 앞부분 60자 정도로
  const name = input.prompt.length > 60 ? `${input.prompt.slice(0, 57)}...` : input.prompt;

  return compiledWorkflowSchema.parse({
    templateId: template.id,
    owner: input.owner,
    name,
    // LLM이 왜 이 템플릿 골랐는지 이유를 설명문으로 같이 저장
    description: input.intent.reasoning,
    chainId: input.chainId,
    parameters,
    // 언제 실행할지(trigger)랑 뭘 할지(actions)는 템플릿에 이미 적혀있음
    // LLM은 거기 비어있는 칸만 채운 거고, 우리는 그대로 가져다 씀
    trigger: template.trigger,
    actions: template.actions,
  });
}
