import { Hono } from 'hono';
import { z } from 'zod';

import { extractWorkflowIntent } from '@loomlabs/llm';

import { log } from '@/log';
import { zValidator } from '@/validate';

export const llmRouter = new Hono();

const extractSchema = z.object({
  prompt: z.string().min(1),
});

llmRouter.post('/extract', zValidator('json', extractSchema), async (c) => {
  const { prompt } = c.req.valid('json');
  log('llm', 'extract requested', { prompt: prompt.slice(0, 60) });
  const intent = await extractWorkflowIntent({ prompt });
  log('llm', 'extract done', {
    templateId: intent.templateId,
    confidence: intent.confidence,
  });
  return c.json({ prompt, intent });
});
