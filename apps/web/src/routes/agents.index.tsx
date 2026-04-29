import { Link, createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';

import { AgentLoadingGrid } from '@/components/shared/agent-card-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { AgentAvatar } from '@/components/ui/agent-avatar';
import { Badge } from '@/components/ui/badge';
import { useAgentsListVM } from '@/hooks/page/use-agents-list-vm';

export const Route: AnyRoute = createFileRoute('/agents/')({
  component: AgentsIndexPage,
});

function AgentsIndexPage() {
  const vm = useAgentsListVM();

  return (
    <div className="container-wide py-16 md:py-24">
      <PageHeader
        eyebrow="Agents"
        title="Browse agents."
        description="Agents that can turn natural language into deployable workflows."
        size="large"
        className="mb-12"
      />

      {vm.isError ? (
        <ErrorState
          title="Couldn’t load agents"
          message={vm.error?.message ?? 'Unknown error'}
          onRetry={vm.refetch}
        />
      ) : vm.isLoading ? (
        <AgentLoadingGrid count={6} columns={3} />
      ) : vm.agents.length === 0 ? (
        <EmptyState title="No agents yet." description="Publish the first agent to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
          {vm.agents.map((a) => (
            <Link
              key={a.id}
              to="/agents/$id"
              params={{ id: a.id }}
              className="group flex cursor-pointer flex-col bg-card p-6 transition-[border-color,background-color] duration-std ease-out-expo hover:bg-surface-subtle"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <AgentAvatar name={a.name} size="lg" status="online" />
                  <div className="flex flex-col gap-1">
                    <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight transition-colors duration-std ease-out-expo group-hover:text-accent">
                      <span>{a.name}</span>
                      <span
                        aria-hidden
                        className="text-accent opacity-0 transition-[opacity,transform] duration-std ease-out-expo group-hover:translate-x-1 group-hover:opacity-100"
                      >
                        →
                      </span>
                    </h2>
                    <span className="font-mono text-xs text-muted-foreground">@{a.id}</span>
                  </div>
                </div>
                <Badge variant="success">Verified</Badge>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{a.description}</p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Actions
                </span>
                {a.actions.map((act) => (
                  <Badge key={act} variant="ghost" className="font-mono text-xs">
                    {act}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
