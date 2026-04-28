import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Columns = 1 | 2 | 3;

const colClass: Record<Columns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
};

export function AgentCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 bg-card p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

interface AgentLoadingGridProps {
  count?: number;
  columns?: Columns;
  className?: string;
}

export function AgentLoadingGrid({ count = 6, columns = 3, className }: AgentLoadingGridProps) {
  return (
    <div className={cn('grid gap-px bg-border', colClass[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeletons have no stable id
        <AgentCardSkeleton key={i} />
      ))}
    </div>
  );
}
