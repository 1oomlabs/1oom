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
    <div className={cn('grid gap-px bg-border', colClass[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeletons have no stable id
        <WorkflowCardSkeleton key={i} />
      ))}
    </div>
  );
}
