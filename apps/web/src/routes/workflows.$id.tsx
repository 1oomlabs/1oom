import { Link, createFileRoute, useParams } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { MonoAddress } from '@/components/ui/mono-address';
import { Separator } from '@/components/ui/separator';
import { StatTile } from '@/components/ui/stat-tile';
import { workflowDetail } from '@/lib/mock';

export const Route: AnyRoute = createFileRoute('/workflows/$id')({
  component: WorkflowDetailPage,
});

function WorkflowDetailPage() {
  const { id } = useParams({ from: '/workflows/$id' });
  const w = workflowDetail; // mock - real impl would key by id

  const statusVariant: Record<typeof w.status, 'success' | 'warning' | 'destructive'> = {
    active: 'success',
    paused: 'warning',
    error: 'destructive',
  };

  return (
    <div className="container-wide py-16 md:py-24">
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-std hover:text-foreground"
      >
        ← Back to marketplace
      </Link>

      <header className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <Eyebrow tone="muted">Workflow · {id}</Eyebrow>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {w.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusVariant[w.status]}>{w.status.toUpperCase()}</Badge>
            <Badge variant="outline">Aave</Badge>
            <Badge variant="outline">Chain {w.chainId}</Badge>
            <span className="text-sm text-muted-foreground">{w.trigger}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">Pause</Button>
          <Button variant="accent">Run now</Button>
        </div>
      </header>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-3">
        {/* Left: parameters + execution plan */}
        <section className="flex flex-col gap-8 lg:col-span-2">
          <div>
            <Eyebrow tone="muted">Parameters</Eyebrow>
            <div className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border">
              {Object.entries(w.parameters).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between bg-card px-5 py-4">
                  <span className="text-sm font-medium text-muted-foreground">{k}</span>
                  <span className="font-mono text-sm tabular text-foreground">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow tone="muted">Recent runs</Eyebrow>
            <ul className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border">
              {w.recentRuns.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-card px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        r.status === 'success' ? 'bg-success' : 'bg-destructive'
                      }`}
                      aria-hidden
                    />
                    <span className="font-mono text-sm tabular">{r.id}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(r.ranAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MonoAddress address={r.txHash} />
                    <span className="text-sm tabular text-muted-foreground">${r.gasUsd}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Right: stats + meta */}
        <aside className="flex flex-col gap-6">
          <StatTile label="Total runs" value={String(w.recentRuns.length * 12)} />
          <StatTile
            label="Success rate"
            value="96%"
            delta={{ value: '+1.2%', trend: 'up' }}
            hint="30d"
          />

          <Separator />

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Author</span>
              <MonoAddress address={w.parameters.token} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pricing</span>
              <span>Free</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="tabular">2026-04-12</span>
            </div>
          </div>

          <Button variant="outline" size="md">
            Fork this workflow
          </Button>
        </aside>
      </div>
    </div>
  );
}
