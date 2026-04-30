import { PrismaClient } from '@prisma/client';

// Prisma client 싱글톤 — tsx watch hot reload 시 커넥션 누수 방지
// (재시작마다 new PrismaClient() 하면 풀 쌓여서 Supabase connection limit 초과)
declare global {
  var __prisma: PrismaClient | undefined;
}

// globalThis는 모듈 캐시가 무효화돼도 살아남아서, hot reload 사이에 인스턴스 재사용 가능
export const prisma = globalThis.__prisma ?? new PrismaClient();

// 프로덕션에선 한 번만 시작하니까 globalThis 저장 불필요 (메모리 위생상)
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
