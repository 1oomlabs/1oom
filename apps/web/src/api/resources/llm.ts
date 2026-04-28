import { type UseMutationResult, useMutation } from '@tanstack/react-query';

import { apiClient } from '../client';
import type { ApiError } from '../errors';
import type { MutationOpts } from '../hooks';
import type { Intent } from './workflows';

export type ExtractIntentResult = {
  prompt: string;
  intent: Intent;
};

/**
 * Non-CRUD endpoint - one-shot natural-language extraction.
 * Returns the prompt echoed back plus the extracted intent.
 */
export function useExtractIntent(
  options?: MutationOpts<ExtractIntentResult, { prompt: string }>,
): UseMutationResult<ExtractIntentResult, ApiError, { prompt: string }> {
  return useMutation<ExtractIntentResult, ApiError, { prompt: string }>({
    ...options,
    mutationFn: ({ prompt }) => apiClient.post<ExtractIntentResult>('/llm/extract', { prompt }),
  });
}
