import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { PromptInput } from '@/components/ui/prompt-input';
import { StatTile } from '@/components/ui/stat-tile';
import { WorkflowCard } from '@/components/ui/workflow-card';
import { marketplaceStats, mockWorkflows, promptExamples } from '@/lib/mock';

export const Route: AnyRoute = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col">
      {/* Hero */}
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

          <PromptInput
            className="mt-4"
            examples={promptExamples}
            onSubmit={() => navigate({ to: '/workflows/new' })}
          />

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Integrates with</span>
            <Badge variant="ghost">KeeperHub</Badge>
            <Badge variant="ghost">ElizaOS</Badge>
            <Badge variant="ghost">Gensyn AXL</Badge>
            <Badge variant="ghost">x402</Badge>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border bg-surface-subtle">
        <div className="container-wide grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          {marketplaceStats.map((s) => (
            <StatTile
              key={s.label}
              label={s.label}
              value={s.value}
              delta={s.delta}
              hint={s.hint}
              className="border-0 bg-card"
            />
          ))}
        </div>
      </section>

      {/* Featured workflows */}
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

        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
          {mockWorkflows.slice(0, 6).map((w) => (
            <WorkflowCard key={w.id} data={w} className="rounded-none border-0" />
          ))}
        </div>
      </section>

      {/* How it works */}
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
