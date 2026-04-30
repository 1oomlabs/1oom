import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { env } from '@/env';
import { mapError } from '@/errors';
import { logError } from '@/log';
import { agentsRouter } from '@/routes/agents';
import { llmRouter } from '@/routes/llm';
import { marketplaceRouter } from '@/routes/marketplace';
import { templatesRouter } from '@/routes/templates';
import { workflowsRouter } from '@/routes/workflows';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.get('/', (c) => c.json({ name: 'loomlabs-api', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }));

app.route('/api/workflows', workflowsRouter);
app.route('/api/marketplace', marketplaceRouter);
app.route('/api/llm', llmRouter);
app.route('/api/agents', agentsRouter);
app.route('/api/templates', templatesRouter);

app.onError((err, c) => {
  // 사용자 친화 응답으로 매핑하되, 콘솔에는 원본 에러 그대로 남김 (디버깅용)
  logError('api', 'unhandled error', err);
  const { status, body } = mapError(err);
  return c.json(body, status);
});

const port = env.PORT;
serve({ fetch: app.fetch, port });
console.log(`[api] listening on http://localhost:${port}`);

export type AppType = typeof app;
