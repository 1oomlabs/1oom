import type { ReactNode } from 'react';

import { Eyebrow } from '@/components/ui/eyebrow';
import { cn } from '@/lib/utils';

type EyebrowTone = 'default' | 'accent' | 'muted';

interface PageHeaderProps {
  eyebrow?: string;
  eyebrowTone?: EyebrowTone;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'default' | 'large';
  className?: string;
}

export function PageHeader({
  eyebrow,
  eyebrowTone = 'accent',
  title,
  description,
  action,
  size = 'default',
  className,
}: PageHeaderProps) {
  const titleClass =
    size === 'large'
      ? 'font-display text-4xl font-semibold tracking-tight md:text-5xl'
      : 'font-display text-3xl font-semibold tracking-tight md:text-4xl';

  return (
    <header
      className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}
    >
      <div className="flex flex-col gap-3">
        {eyebrow && <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>}
        <h1 className={titleClass}>{title}</h1>
        {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}
