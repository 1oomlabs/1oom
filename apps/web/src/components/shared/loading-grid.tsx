import { WorkflowCardSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Columns = 1 | 2 | 3 | 4;

interface LoadingGridProps {
  count?: number;
  columns?: Columns;
  className?: string;
}

const colClass: Record<Columns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

export function LoadingGrid({ count = 6, columns = 3, className }: LoadingGridProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <img
          src="/logo-transparent.png"
          alt=""
          aria-hidden
          className="h-3.5 w-3.5 animate-pulse object-contain"
          loading="lazy"
          decoding="async"
        />
        <span className="font-medium">Loading with Loomlabs...</span>
      </div>
      <div className={cn('grid gap-px bg-border', colClass[columns])}>
        {Array.from({ length: count }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeletons have no stable id
          <WorkflowCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
