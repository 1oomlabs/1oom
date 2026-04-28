import { createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { type MarketplaceListing, useMarketplaceList } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { WorkflowCardSkeleton } from '@/components/ui/skeleton';
import { WorkflowCard } from '@/components/ui/workflow-card';
import { listingToCard, protocolFromTemplateId } from '@/lib/view-models';

export const Route: AnyRoute = createFileRoute('/marketplace')({
  component: MarketplacePage,
});

const protocols = ['all', 'aave', 'uniswap', 'lido', 'custom'] as const;
type ProtocolFilter = (typeof protocols)[number];

const sorts = [
  { value: 'popular', label: 'Most installed' },
  { value: 'newest', label: 'Newest' },
] as const;
type SortValue = (typeof sorts)[number]['value'];

function MarketplacePage() {
  const [filter, setFilter] = useState<ProtocolFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortValue>('popular');

  const {
    data: listings,
    isLoading,
    isError,
    error,
    refetch,
  } = useMarketplaceList({
    sort,
  });

  const filtered: MarketplaceListing[] = useMemo(() => {
    const items = listings ?? [];
    return items.filter((l) => {
      if (filter !== 'all' && protocolFromTemplateId(l.workflow.templateId) !== filter) {
        return false;
      }
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        l.workflow.name.toLowerCase().includes(q) ||
        (l.workflow.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [listings, filter, query]);

  return (
    <div className="container-wide py-16 md:py-24">
      <header className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <Eyebrow tone="accent">Marketplace</Eyebrow>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Discover workflows.
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Free and x402-priced automations published by humans and agents.
          </p>
        </div>
        <Button variant="accent" size="lg" asChild>
          <a href="/workflows/new">Publish workflow</a>
        </Button>
      </header>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {protocols.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setFilter(p)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-std ${
                filter === p
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workflows…"
            className="w-full md:w-64"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortValue)}
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
          {isLoading ? '—' : filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </span>
        <div className="hidden items-center gap-2 md:flex">
          <Badge variant="ghost">Free</Badge>
          <Badge variant="ghost">x402</Badge>
          <Badge variant="ghost">Verified</Badge>
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-4 border border-dashed border-destructive/40 bg-destructive/5 py-20 text-center">
          <p className="font-display text-xl font-semibold tracking-tight">
            Couldn’t load marketplace
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            {error?.message ?? 'Unknown error'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeletons have no stable id
            <WorkflowCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 border border-dashed border-border bg-surface-subtle py-24 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight">No matches</p>
          <p className="max-w-prose text-muted-foreground">
            Try a different protocol filter or search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
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
