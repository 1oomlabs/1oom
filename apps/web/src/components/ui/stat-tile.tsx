import { cn } from '@/lib/utils';

interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  delta?: { value: string; trend: 'up' | 'down' | 'flat' };
  hint?: string;
}

export function StatTile({ label, value, delta, hint, className, ...props }: StatTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border border-border bg-card p-6',
        'transition-colors duration-std ease-out-expo hover:border-foreground/20',
        className,
      )}
      {...props}
    >
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="font-display text-4xl font-bold tracking-tight tabular md:text-5xl">
        {value}
      </span>
      <div className="flex items-center gap-3 text-sm">
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-1 font-medium tabular',
              delta.trend === 'up' && 'text-success',
              delta.trend === 'down' && 'text-destructive',
              delta.trend === 'flat' && 'text-muted-foreground',
            )}
          >
            {delta.trend === 'up' && '↑'}
            {delta.trend === 'down' && '↓'}
            {delta.trend === 'flat' && '–'}
            {delta.value}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
