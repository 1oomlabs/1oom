import { KeeperHubClient } from '@loomlabs/keeperhub-client';

import { env } from '@/env';

let client: KeeperHubClient | undefined;

// KeeperHubClient 싱글톤 — 첫 호출 시 env 확인하고 생성
// env 누락 시 throw — deploy 단계에서 명시적 에러로 끊는 게 디버깅 편함
export function getKeeperHubClient(): KeeperHubClient {
  if (client) return client;
  if (!env.KEEPERHUB_API_URL || !env.KEEPERHUB_API_KEY) {
    throw new Error(
      '[keeperhub] KEEPERHUB_API_URL and KEEPERHUB_API_KEY must be set in apps/api/.env',
    );
  }
  client = new KeeperHubClient({
    baseUrl: env.KEEPERHUB_API_URL,
    apiKey: env.KEEPERHUB_API_KEY,
  });
  return client;
}
