import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  variant?: 'default' | 'dashed';
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  variant = 'dashed',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 py-20 text-center',
        variant === 'dashed'
          ? 'border border-dashed border-border bg-surface-subtle'
          : 'border border-border bg-card',
        className,
      )}
    >
      {icon}
      <p className="font-display text-2xl font-semibold tracking-tight">{title}</p>
      {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
