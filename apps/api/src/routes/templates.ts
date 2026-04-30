import { Hono } from 'hono';

import { getSepoliaTemplateMetadata, getTemplateById, templates } from '@loomlabs/templates';

export const templatesRouter = new Hono();

// 템플릿 카탈로그 — DB가 아니라 packages/templates의 정적 데이터 (C 영역)
// 새 템플릿 추가 시 백엔드 코드 변경 0 — templates 배열에 들어오면 자동 노출
templatesRouter.get('/', (c) => {
  return c.json({ templates, total: templates.length });
});

// 단건 조회 — 템플릿 정의 + Sepolia 메타데이터(컨트랙트 주소 등) 같이 반환
// sepolia 메타는 알려진 3개 ID에만 있고, 없으면 undefined
templatesRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const template = getTemplateById(id);
  if (!template) {
    return c.json({ error: 'template not found' }, 404);
  }
  const sepolia = getSepoliaTemplateMetadata(id);
  return c.json({ template, sepolia });
});
