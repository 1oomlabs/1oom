import { zValidator as baseZValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';

// @hono/zod-validator의 기본 에러 응답은 raw ZodError 모양이라
// 우리 친절 에러 shape({code, message, details})으로 통일하기 위한 wrapper
type Target = 'json' | 'query' | 'param' | 'header' | 'cookie' | 'form';

export function zValidator<T extends ZodSchema>(target: Target, schema: T) {
  type BaseTarget = Parameters<typeof baseZValidator>[0];
  return baseZValidator(target as BaseTarget, schema, (result, c) => {
    if (!result.success) {
      const details = result.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join(', ');
      return c.json(
        {
          code: 'VALIDATION_FAILED',
          message: '입력 형식이 올바르지 않아요.',
          details,
        },
        400,
      );
    }
  });
}
