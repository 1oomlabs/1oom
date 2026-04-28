import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export function WorkflowCardSkeleton() {
  return (
    <div className="flex flex-col gap-5 border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-6 w-56" />
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
