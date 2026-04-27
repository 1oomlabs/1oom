import { cn } from '@/lib/utils';

interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'default' | 'accent' | 'muted';
}

export function Eyebrow({ className, tone = 'default', children, ...props }: EyebrowProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]',
        tone === 'default' && 'text-foreground',
        tone === 'accent' && 'text-accent',
        tone === 'muted' && 'text-muted-foreground',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="h-px w-6 bg-current opacity-60" />
      {children}
    </span>
  );
}
