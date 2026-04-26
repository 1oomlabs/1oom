import { createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { WorkflowCard } from '@/components/ui/workflow-card';
import type { WorkflowCardData } from '@/components/ui/workflow-card';
import { mockWorkflows } from '@/lib/mock';

export const Route: AnyRoute = createFileRoute('/marketplace')({
  component: MarketplacePage,
});

const protocols = ['all', 'aave', 'uniswap', 'lido', 'custom'] as const;
type ProtocolFilter = (typeof protocols)[number];

const sorts = [
  { value: 'popular', label: 'Most installed' },
  { value: 'newest', label: 'Newest' },
  { value: 'runs', label: 'Most runs' },
] as const;

function MarketplacePage() {
  const [filter, setFilter] = useState<ProtocolFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<(typeof sorts)[number]['value']>('popular');

  const filtered: WorkflowCardData[] = mockWorkflows
    .filter((w) => (filter === 'all' ? true : w.protocol === filter))
    .filter(
      (w) =>
        !query ||
        w.name.toLowerCase().includes(query.toLowerCase()) ||
        w.description.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === 'popular') return b.installs - a.installs;
      if (sort === 'runs') return b.runs - a.runs;
      return 0;
    });

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
        <Button variant="accent" size="lg">
          Publish workflow
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
            onChange={(e) => setSort(e.target.value as typeof sort)}
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
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </span>
        <div className="hidden md:flex items-center gap-2">
          <Badge variant="ghost">Free</Badge>
          <Badge variant="ghost">x402</Badge>
          <Badge variant="ghost">Verified</Badge>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 border border-dashed border-border bg-surface-subtle py-24 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight">No matches</p>
          <p className="max-w-prose text-muted-foreground">
            Try a different protocol filter or search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <WorkflowCard key={w.id} data={w} className="rounded-none border-0" />
          ))}
        </div>
      )}
    </div>
  );
}
