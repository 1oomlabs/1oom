import { type UseMutationResult, useMutation } from '@tanstack/react-query';

import { apiClient } from '../client';
import type { ApiError } from '../errors';
import type { MutationOpts } from '../hooks';

export interface ExtractIntentResult {
  templateId: string;
  confidence: number;
  parameters: Record<string, unknown>;
  reasoning?: string;
}

/**
 * Non-CRUD endpoint - one-shot natural-language extraction. Bypasses
 * `Resource<T>` because there is no list/detail shape to model. Uses
 * `apiClient` directly which is the right pattern for action endpoints.
 */
export function useExtractIntent(
  options?: MutationOpts<ExtractIntentResult, { prompt: string }>,
): UseMutationResult<ExtractIntentResult, ApiError, { prompt: string }> {
  return useMutation<ExtractIntentResult, ApiError, { prompt: string }>({
    ...options,
    mutationFn: ({ prompt }) => apiClient.post<ExtractIntentResult>('/llm/extract', { prompt }),
  });
}
