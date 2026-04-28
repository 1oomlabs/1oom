import { createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';

import { AgentAvatar } from '@/components/ui/agent-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { MonoAddress } from '@/components/ui/mono-address';
import { Separator } from '@/components/ui/separator';
import { StatTile } from '@/components/ui/stat-tile';
import { WorkflowCard } from '@/components/ui/workflow-card';
import { mockAgent, mockWorkflows } from '@/lib/mock';

export const Route: AnyRoute = createFileRoute('/agents/$id')({
  component: AgentProfilePage,
});

function AgentProfilePage() {
  const a = mockAgent;
  const authored = mockWorkflows.filter((w) => w.author === a.address);

  return (
    <div className="container-wide py-16 md:py-24">
      <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="flex items-end gap-6">
          <AgentAvatar name={a.name} size="xl" status="online" />
          <div className="flex flex-col gap-2">
            <Eyebrow tone="muted">Agent</Eyebrow>
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              {a.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">@{a.handle}</span>
              <MonoAddress address={a.address} />
              <Badge variant="success">Verified</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">Follow</Button>
          <Button variant="accent">Subscribe via x402</Button>
        </div>
      </header>

      <p className="mt-8 max-w-prose text-lg text-muted-foreground">{a.bio}</p>

      <div className="mt-12 grid grid-cols-1 gap-px bg-border md:grid-cols-3">
        <StatTile
          label="Workflows"
          value={String(a.stats.published)}
          className="border-0 bg-card"
        />
        <StatTile
          label="Total installs"
          value={a.stats.installs.toLocaleString()}
          className="border-0 bg-card"
        />
        <StatTile
          label="Total runs"
          value={a.stats.runs.toLocaleString()}
          className="border-0 bg-card"
        />
      </div>

      <Separator className="my-16" />

      <section>
        <div className="mb-8 flex flex-col gap-3">
          <Eyebrow tone="accent">Published</Eyebrow>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Workflows by {a.name}
          </h2>
        </div>

        {authored.length === 0 ? (
          <div className="border border-dashed border-border bg-surface-subtle py-16 text-center">
            <p className="text-muted-foreground">No published workflows yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
            {authored.map((w) => (
              <WorkflowCard key={w.id} data={w} className="rounded-none border-0" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
