import { Hono } from 'hono';

export const marketplaceRouter = new Hono();

marketplaceRouter.get('/', (c) => {
  return c.json({ items: [] });
});

marketplaceRouter.get('/:id', (c) => {
  return c.json({ id: c.req.param('id'), status: 'not_found' }, 404);
});
