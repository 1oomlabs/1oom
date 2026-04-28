import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';

import { useMarketplaceList } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { PromptInput } from '@/components/ui/prompt-input';
import { WorkflowCardSkeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { WorkflowCard } from '@/components/ui/workflow-card';
import { listingToCard } from '@/lib/view-models';
import { useDraftStore } from '@/store/draft-store';

const promptExamples = [
  'Every Friday, deposit 100 USDC into Aave',
  'Buy 0.05 ETH each Monday with USDC on Uniswap',
  'Stake 1 ETH into Lido and compound stETH monthly',
];

export const Route: AnyRoute = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const setPrompt = useDraftStore((s) => s.setPrompt);

  const { data: listings, isLoading } = useMarketplaceList(
    { sort: 'popular', limit: 6 },
    { staleTime: 30_000 },
  );

  const featured = (listings ?? []).slice(0, 6);

  const totalRuns = featured.reduce((sum, l) => sum + l.stats.runs, 0);
  const totalInstalls = featured.reduce((sum, l) => sum + l.stats.installs, 0);
  const stats = [
    { label: 'Workflows', value: String(listings?.length ?? 0) },
    { label: 'Featured', value: String(featured.length) },
    { label: 'Total runs', value: totalRuns.toLocaleString() },
    { label: 'Total installs', value: totalInstalls.toLocaleString() },
  ];

  const onPromptSubmit = (value: string) => {
    setPrompt(value);
    navigate({ to: '/workflows/new' });
  };

  return (
    <div className="flex flex-col">
      <section className="container-wide pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="flex flex-col gap-8 md:max-w-4xl">
          <Eyebrow tone="accent">From a sentence to a workflow</Eyebrow>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-balance md:text-7xl">
            DeFi automation,
            <br />
            <span className="text-accent">written in plain English.</span>
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground md:text-xl">
            Describe what you want. We compile it into a parameterised workflow, deploy it on
            KeeperHub, and publish it to a marketplace where other agents can discover and remix it.
          </p>

          <PromptInput className="mt-4" examples={promptExamples} onSubmit={onPromptSubmit} />

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Integrates with</span>
            <Badge variant="ghost">KeeperHub</Badge>
            <Badge variant="ghost">ElizaOS</Badge>
            <Badge variant="ghost">Gensyn AXL</Badge>
            <Badge variant="ghost">x402</Badge>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface-subtle">
        <div className="container-wide grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          {stats.map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} className="border-0 bg-card" />
          ))}
        </div>
      </section>

      <section className="container-wide py-24">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="flex flex-col gap-3">
            <Eyebrow tone="muted">Marketplace</Eyebrow>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Workflows the community is using
            </h2>
            <p className="max-w-prose text-muted-foreground">
              Each workflow is a parameterised template that an agent has fully wired, tested, and
              listed.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/marketplace">Browse all →</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeletons have no stable id
              <WorkflowCardSkeleton key={i} />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <EmptyMarketplace />
        ) : (
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
            {featured.map((listing) => (
              <WorkflowCard
                key={listing.id}
                data={listingToCard(listing)}
                className="rounded-none border-0"
              />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border bg-surface-subtle">
        <div className="container-wide py-24">
          <div className="mb-16 flex flex-col gap-3">
            <Eyebrow tone="muted">How it works</Eyebrow>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              Three steps. One sentence in, one keeper job out.
            </h2>
          </div>

          <ol className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {[
              {
                n: '01',
                title: 'Describe',
                body: 'Type what you want in natural language. Claude maps it to a template and extracts the parameters.',
              },
              {
                n: '02',
                title: 'Review',
                body: 'See the resolved workflow as typed JSON. Tweak parameters, run a dry simulation, or just accept.',
              },
              {
                n: '03',
                title: 'Deploy & share',
                body: 'KeeperHub deploys the job. Optionally publish it to the marketplace and earn from x402 micropayments.',
              },
            ].map((step) => (
              <li key={step.n} className="flex flex-col gap-4">
                <span className="font-mono text-sm tabular text-accent">{step.n}</span>
                <h3 className="font-display text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function EmptyMarketplace() {
  return (
    <div className="flex flex-col items-center gap-4 border border-dashed border-border bg-surface-subtle py-20 text-center">
      <p className="font-display text-2xl font-semibold tracking-tight">No workflows yet</p>
      <p className="max-w-prose text-muted-foreground">
        Be the first to publish. Describe an automation above and ship it in under a minute.
      </p>
    </div>
  );
}
