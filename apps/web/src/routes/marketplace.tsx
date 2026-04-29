import { Link, createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingGrid } from '@/components/shared/loading-grid';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkflowCard } from '@/components/ui/workflow-card';
import {
  marketplaceSearchSchema,
  protocols,
  sorts,
  useMarketplacePageVM,
} from '@/hooks/page/use-marketplace-page-vm';
import { listingToCard } from '@/lib/view-models';

export const Route = createFileRoute('/marketplace')({
  validateSearch: marketplaceSearchSchema,
  component: MarketplacePage,
});

function MarketplacePage() {
  const vm = useMarketplacePageVM();

  return (
    <div className="container-wide py-16 md:py-24">
      <PageHeader
        eyebrow="Marketplace"
        title="Discover workflows."
        description="Free and x402-priced automations published by humans and agents."
        size="large"
        action={
          <Button variant="accent" size="lg" asChild>
            <Link to="/workflows/new">Publish workflow</Link>
          </Button>
        }
        className="mb-12"
      />

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {protocols.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => vm.setFilter(p)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-std ${
                vm.filter === p
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              }`}
            >
              {p === 'all' ? 'All protocols' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Input
            type="search"
            value={vm.query}
            onChange={(e) => vm.setQuery(e.target.value)}
            placeholder="Search workflows…"
            className="w-full md:w-64"
          />
          <select
            value={vm.sort}
            onChange={(e) => vm.setSort(e.target.value as typeof vm.sort)}
            className="h-10 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular">
          {vm.isLoading ? '—' : vm.totalCount} {vm.totalCount === 1 ? 'result' : 'results'}
        </span>
        <div className="hidden items-center gap-2 md:flex">
          <Badge variant="ghost">Free</Badge>
          <Badge variant="ghost">x402</Badge>
          <Badge variant="ghost">Verified</Badge>
        </div>
      </div>

      {vm.isError ? (
        <ErrorState
          title="Couldn’t load marketplace"
          message={vm.error?.message ?? 'Unknown error'}
          onRetry={vm.refetch}
        />
      ) : vm.isLoading ? (
        <LoadingGrid count={6} columns={3} />
      ) : vm.totalCount === 0 ? (
        <EmptyState
          title="No matches"
          description="Try a different protocol filter or search term."
        />
      ) : (
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
          {vm.results.map((listing) => (
            <WorkflowCard
              key={listing.id}
              data={listingToCard(listing)}
              className="rounded-none border-0"
            />
          ))}
        </div>
      )}
    </div>
  );
}
