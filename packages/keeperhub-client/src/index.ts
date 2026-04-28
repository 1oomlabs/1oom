import type { Workflow } from '@loomlabs/schema';

export type KeeperHubClientOptions = {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export type DeployResult = {
  keeperJobId: string;
  status: 'queued' | 'active';
};

export type JobStatusResult = {
  jobId: string;
  status: string;
};

export type ExecuteResult = {
  executionId: string;
  status: string;
};

// KeeperHub HTTP API를 감싸는 얇은 wrapper
// 인증: Bearer kh_... (Workflows API 기준, env의 KEEPERHUB_API_KEY 사용)
// baseUrl은 https://app.keeperhub.com/api 까지 포함된 형태로 들어옴
export class KeeperHubClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: KeeperHubClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  // 워크플로우를 KeeperHub에 등록하고 keeperJobId 받아오기
  // nodes/edges는 빈 배열로 보내면 KeeperHub가 Manual trigger + 빈 action 노드 자동 생성
  // 자동화 노드 채우기는 후속 작업 (PATCH /workflows/{id}로 nodes 채울 수 있음)
  async deployWorkflow(workflow: Workflow): Promise<DeployResult> {
    const res = await this.request<unknown>('/workflows/create', {
      method: 'POST',
      body: JSON.stringify({
        name: workflow.name,
        description: workflow.description ?? `Compiled from template: ${workflow.templateId}`,
        nodes: [],
        edges: [],
      }),
    });

    // 응답이 {data: {...}} 일 수도, bare object 일 수도 있어 둘 다 처리
    const id = extractId(res);
    if (!id) {
      throw new Error('[keeperhub] deploy succeeded but no workflow id in response');
    }
    return { keeperJobId: id, status: 'queued' };
  }

  // 등록된 워크플로우 상태 조회
  // KeeperHub 응답에 'status' 필드가 없으면 'enabled' 불리언으로 대체 (active/inactive)
  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const res = await this.request<unknown>(`/workflows/${jobId}`);
    const status = extractField(res, 'status');
    if (status !== undefined) {
      return { jobId, status: String(status) };
    }
    const enabled = extractField(res, 'enabled');
    if (typeof enabled === 'boolean') {
      return { jobId, status: enabled ? 'active' : 'inactive' };
    }
    return { jobId, status: 'unknown' };
  }

  // 워크플로우 수동 실행 ("Run now") — KeeperHub Workflows API 트리거
  // POST /workflow/{id}/execute (단수 'workflow' 주의 — 다른 endpoint와 다름)
  async executeWorkflow(jobId: string): Promise<ExecuteResult> {
    const res = await this.request<unknown>(`/workflow/${jobId}/execute`, {
      method: 'POST',
    });
    const executionId =
      (extractField(res, 'executionId') as string | undefined) ??
      (extractField(res, 'runId') as string | undefined) ??
      'unknown';
    const status = String(extractField(res, 'status') ?? 'pending');
    return { executionId, status };
  }

  // 일시정지 — KeeperHub Workflows API에 pause endpoint 없음
  // 호출 측이 우리 store status='paused'로 마킹하는 걸로 처리, 여기서는 no-op
  async pauseJob(_jobId: string): Promise<void> {
    return;
  }

  // 재개 — pauseJob과 동일하게 no-op
  // 사용자 가시 상태는 우리 store에서 'deployed'로 되돌리면 충분
  async resumeJob(_jobId: string): Promise<void> {
    return;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      // 디버깅 편하게 에러 본문도 같이 노출
      const body = await res.text().catch(() => '');
      throw new Error(`[keeperhub] ${res.status} ${res.statusText}: ${body}`);
    }
    return (await res.json()) as T;
  }
}

// 응답이 {data: {id}} / {id} 어떤 모양이든 id 뽑아내기
function extractId(res: unknown): string | undefined {
  if (!res || typeof res !== 'object') return undefined;
  const obj = res as Record<string, unknown>;
  if (typeof obj.id === 'string') return obj.id;
  const data = obj.data;
  if (data && typeof data === 'object' && 'id' in data) {
    const id = (data as Record<string, unknown>).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

// 응답 wrapper 어디든 특정 필드 꺼내기 (status 등)
function extractField(res: unknown, field: string): unknown {
  if (!res || typeof res !== 'object') return undefined;
  const obj = res as Record<string, unknown>;
  if (field in obj) return obj[field];
  const data = obj.data;
  if (data && typeof data === 'object' && field in data) {
    return (data as Record<string, unknown>)[field];
  }
  return undefined;
}
