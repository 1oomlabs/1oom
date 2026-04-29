import { PrismaClient } from '@prisma/client';

// 기본 시드 — DB 초기화 후 1회 실행 (`pnpm prisma db seed`)
// upsert 사용해서 재실행해도 안전하게 동작 (중복 키 에러 없음)
const prisma = new PrismaClient();

async function main() {
  await prisma.agent.upsert({
    where: { id: 'loomlabs' },
    update: {},
    create: {
      id: 'loomlabs',
      name: 'Loomlabs Agent',
      description: 'Turns natural language into DeFi workflows on KeeperHub.',
      actions: ['CREATE_WORKFLOW_INTENT'],
    },
  });
  console.log('[seed] loomlabs agent ready');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
