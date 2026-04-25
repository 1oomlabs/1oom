import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { env } from '@/env';
import { llmRouter } from '@/routes/llm';
import { marketplaceRouter } from '@/routes/marketplace';
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

app.onError((err, c) => {
  console.error('[api] unhandled error:', err);
  return c.json({ error: err.message || 'internal error' }, 500);
});

const port = env.PORT;
serve({ fetch: app.fetch, port });
console.log(`[api] listening on http://localhost:${port}`);

export type AppType = typeof app;
