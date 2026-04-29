import { create } from 'zustand';

import { TOAST_DEFAULT_DURATION_MS } from '@/lib/constants';

export type ToastVariant = 'default' | 'success' | 'destructive' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;

  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (
    input: Omit<Toast, 'id' | 'duration' | 'variant'> & {
      id?: string;
      duration?: number;
      variant?: ToastVariant;
    },
  ) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (input) => {
    const id = input.id ?? Math.random().toString(36).slice(2);
    const toast: Toast = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant ?? 'default',
      duration: input.duration ?? TOAST_DEFAULT_DURATION_MS,
    };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    if (toast.duration > 0) {
      setTimeout(() => get().dismiss(id), toast.duration);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export const toast = {
  show: (input: Parameters<ToastState['push']>[0]) => useToastStore.getState().push(input),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'destructive' }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'warning' }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description }),
};
