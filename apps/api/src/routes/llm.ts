import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

export const llmRouter = new Hono();

const extractSchema = z.object({
  prompt: z.string().min(1),
});

llmRouter.post('/extract', zValidator('json', extractSchema), async (c) => {
  const { prompt } = c.req.valid('json');
  // TODO(roleset-2): wire to @loomlabs/llm extractWorkflowIntent
  return c.json({
    prompt,
    intent: null,
    message: 'stub - wire to packages/llm',
  });
});
