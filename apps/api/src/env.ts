import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8787),
  // 콤마 구분 문자열로 받아 배열로 변환 — staging/prod/preview URL 동시 허용 위함
  // 예: "http://localhost:3000,https://1oom.app,https://staging.1oom.app"
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),

  ANTHROPIC_API_KEY: z.string().optional(),

  KEEPERHUB_API_URL: z.string().url().optional(),
  KEEPERHUB_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
