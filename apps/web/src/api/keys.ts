import type { ListParams } from './resource';

/**
 * Deterministic query-key factory bound to a resource path.
 *
 * Conventions:
 *   key.all()                      → ['workflows']
 *   key.list(params)               → ['workflows', 'list', { ...params }]
 *   key.detail(id)                 → ['workflows', 'detail', id]
 *   key.action(name, args?)        → ['workflows', 'action', name, args]
 *
 * Use these factories instead of inline arrays so invalidation stays correct.
 */
export function makeQueryKeys(resourcePath: string) {
  const root = stripLeadingSlash(resourcePath);
  return {
    all: () => [root] as const,
    list: (params?: ListParams) => [root, 'list', params ?? {}] as const,
    detail: (id: string) => [root, 'detail', id] as const,
    action: (name: string, args?: unknown) => [root, 'action', name, args] as const,
  };
}

export type QueryKeyFactory = ReturnType<typeof makeQueryKeys>;

function stripLeadingSlash(s: string): string {
  return s.startsWith('/') ? s.slice(1) : s;
}
