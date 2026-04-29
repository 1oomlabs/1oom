import { Link, createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';

import { EmptyState } from '@/components/shared/empty-state';
import { LoadingGrid } from '@/components/shared/loading-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { PromptInput } from '@/components/ui/prompt-input';
import { StatTile } from '@/components/ui/stat-tile';
import { WorkflowCard } from '@/components/ui/workflow-card';
import { promptExamples, useHomePageVM } from '@/hooks/page/use-home-page-vm';
import { listingToCard } from '@/lib/view-models';

export const Route: AnyRoute = createFileRoute('/')({
  component: HomePage,
});

const howItWorks = [
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
];

function HomePage() {
  const vm = useHomePageVM();

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

          <PromptInput className="mt-4" examples={promptExamples} onSubmit={vm.onPromptSubmit} />

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
          {vm.stats.map((s) => (
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

        {vm.isLoading ? (
          <LoadingGrid count={6} columns={3} />
        ) : vm.featured.length === 0 ? (
          <EmptyState
            title="No workflows yet"
            description="Be the first to publish. Describe an automation above and ship it in under a minute."
          />
        ) : (
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
            {vm.featured.map((listing) => (
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
            {howItWorks.map((step) => (
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
