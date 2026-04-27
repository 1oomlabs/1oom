import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

import { type Template, templateSchema } from '@loomlabs/schema';
import { findTemplatesByKeyword, templates } from '@loomlabs/templates';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'; //sonnet-4-6 우선 보류

export type ExtractIntentInput = {
  prompt: string;
  model?: string;
};

export const intentSchema = z.object({
  templateId: z.string(),
  confidence: z.number().min(0).max(1),
  parameters: z.record(z.string(), z.unknown()),
  reasoning: z.string().optional(),
});
export type Intent = z.infer<typeof intentSchema>;

/**
 * Turn a natural language prompt into a (template, parameters) pair.
 * This is the core of the "natural language -> workflow" pipeline.
 */
export async function extractWorkflowIntent(input: ExtractIntentInput): Promise<Intent> {
  const model = anthropic(input.model ?? DEFAULT_MODEL);

  const catalog = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const { object } = await generateObject({
    model,
    schema: intentSchema,
    system:
      'You map a natural-language DeFi automation request to exactly one template from the catalog below, ' +
      'and extract concrete parameter values. If the request is ambiguous, pick the best match and lower confidence.',
    prompt: [
      `User request: ${input.prompt}`,
      '',
      'Template catalog:',
      JSON.stringify(catalog, null, 2),
    ].join('\n'),
  });

  return object;
}

/**
 * Cheap keyword-based prefilter used to narrow the candidate set before LLM.
 */
export function candidateTemplates(prompt: string): Template[] {
  const tokens = prompt.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = new Map<string, { template: Template; score: number }>();

  for (const tok of tokens) {
    for (const t of findTemplatesByKeyword(tok)) {
      const curr = scored.get(t.id);
      if (curr) curr.score += 1;
      else scored.set(t.id, { template: t, score: 1 });
    }
  }

  return [...scored.values()].sort((a, b) => b.score - a.score).map((s) => s.template);
}

export { templateSchema };
