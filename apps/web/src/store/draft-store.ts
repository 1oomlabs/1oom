import { create } from 'zustand';

import type { Intent } from '@/api';

interface DraftState {
  prompt: string;
  intent: Intent | null;

  overrides: Record<string, unknown>;

  setPrompt: (prompt: string) => void;
  setIntent: (intent: Intent | null) => void;
  setOverride: (key: string, value: unknown) => void;
  reset: () => void;

  resolvedParameters: () => Record<string, unknown>;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  prompt: '',
  intent: null,
  overrides: {},

  setPrompt: (prompt) => set({ prompt }),
  setIntent: (intent) => set({ intent, overrides: {} }),
  setOverride: (key, value) => set((s) => ({ overrides: { ...s.overrides, [key]: value } })),
  reset: () => set({ prompt: '', intent: null, overrides: {} }),

  resolvedParameters: () => {
    const { intent, overrides } = get();
    return { ...(intent?.parameters ?? {}), ...overrides };
  },
}));
