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

/**
 * Thin typed wrapper over the KeeperHub HTTP API.
 *
 * TODO(roleset-2): fill in real endpoint paths once KeeperHub docs are confirmed.
 */
export class KeeperHubClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: KeeperHubClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async deployWorkflow(workflow: Workflow): Promise<DeployResult> {
    const res = await this.request('/jobs', {
      method: 'POST',
      body: JSON.stringify({ workflow }),
    });
    return res as DeployResult;
  }

  async getJobStatus(jobId: string): Promise<{ jobId: string; status: string }> {
    return (await this.request(`/jobs/${jobId}`)) as { jobId: string; status: string };
  }

  async pauseJob(jobId: string): Promise<void> {
    await this.request(`/jobs/${jobId}/pause`, { method: 'POST' });
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      throw new Error(`[keeperhub] ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as unknown;
  }
}
