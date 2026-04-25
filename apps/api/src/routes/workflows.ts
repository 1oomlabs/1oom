import { Hono } from 'hono';

export const workflowsRouter = new Hono();

workflowsRouter.get('/', (c) => {
  return c.json({ workflows: [] });
});

workflowsRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ ok: true, received: body }, 201);
});

workflowsRouter.get('/:id', (c) => {
  return c.json({ id: c.req.param('id'), status: 'not_found' }, 404);
});
