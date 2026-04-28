import { Link, createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingGrid } from '@/components/shared/loading-grid';
import { AgentAvatar } from '@/components/ui/agent-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { WorkflowCard } from '@/components/ui/workflow-card';
import { useAgentProfileVM } from '@/hooks/page/use-agent-profile-vm';
import { listingToCard } from '@/lib/view-models';

export const Route: AnyRoute = createFileRoute('/agents/$id')({
  component: AgentProfilePage,
});

function AgentProfilePage() {
  const vm = useAgentProfileVM();

  if (vm.isLoading) {
    return (
      <div className="container-wide py-16 md:py-24">
        <div className="flex items-end gap-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <Skeleton className="mt-8 h-6 w-2/3" />
      </div>
    );
  }

  if (vm.isError || !vm.agent) {
    return (
      <div className="container-wide py-24">
        <ErrorState title="Agent not found" message={`No agent with id "${vm.id}".`} />
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link to="/marketplace">Back to marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { agent, listings, loadingListings, stats } = vm;

  return (
    <div className="container-wide py-16 md:py-24">
      <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="flex items-end gap-6">
          <AgentAvatar name={agent.name} size="xl" status="online" />
          <div className="flex flex-col gap-2">
            <Eyebrow tone="muted">Agent</Eyebrow>
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              {agent.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">@{agent.id}</span>
              <Badge variant="success">Verified</Badge>
              {agent.actions.map((a) => (
                <Badge key={a} variant="ghost" className="font-mono text-xs">
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">Follow</Button>
          <Button variant="accent" asChild>
            <Link to="/workflows/new">Use this agent</Link>
          </Button>
        </div>
      </header>

      <p className="mt-8 max-w-prose text-lg text-muted-foreground">{agent.description}</p>

      <div className="mt-12 grid grid-cols-1 gap-px bg-border md:grid-cols-3">
        <StatTile
          label="Listings"
          value={String(stats.totalListings)}
          className="border-0 bg-card"
        />
        <StatTile
          label="Total installs"
          value={stats.totalInstalls.toLocaleString()}
          className="border-0 bg-card"
        />
        <StatTile
          label="Total runs"
          value={stats.totalRuns.toLocaleString()}
          className="border-0 bg-card"
        />
      </div>

      <Separator className="my-16" />

      <section>
        <div className="mb-8 flex flex-col gap-3">
          <Eyebrow tone="accent">Marketplace activity</Eyebrow>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Recent listings</h2>
        </div>

        {loadingListings ? (
          <LoadingGrid count={3} columns={3} />
        ) : listings.length === 0 ? (
          <EmptyState title="No marketplace activity yet." />
        ) : (
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
            {listings.slice(0, 6).map((l) => (
              <WorkflowCard key={l.id} data={listingToCard(l)} className="rounded-none border-0" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
