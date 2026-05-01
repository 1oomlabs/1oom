import { Link, createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { MonoAddress } from '@/components/ui/mono-address';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { useWorkflowDetailVM } from '@/hooks/page/use-workflow-detail-vm';

export const Route: AnyRoute = createFileRoute('/workflows/$id')({
  component: WorkflowDetailPage,
});

function WorkflowDetailPage() {
  const vm = useWorkflowDetailVM();

  if (vm.isLoading) {
    return (
      <div className="container-wide py-16 md:py-24">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-6 h-12 w-3/4" />
        <Skeleton className="mt-3 h-6 w-1/2" />
        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (vm.isError || !vm.workflow) {
    return (
      <div className="container-wide py-24">
        <ErrorState
          title="Workflow not found"
          message={vm.error?.message ?? `No workflow with id ${vm.id}`}
          onRetry={vm.refetch}
        />
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link to="/marketplace">Back to marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { workflow } = vm;

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
          <Eyebrow tone="muted">Workflow · {workflow.id.slice(0, 8)}</Eyebrow>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {workflow.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {vm.statusBadgeVariant && (
              <Badge variant={vm.statusBadgeVariant}>{workflow.status.toUpperCase()}</Badge>
            )}
            {vm.protocolLabel && <Badge variant="outline">{vm.protocolLabel}</Badge>}
            <Badge variant="outline">Chain {workflow.chainId}</Badge>
            {workflow.trigger.type === 'cron' && (
              <span className="text-sm text-muted-foreground">
                cron · {workflow.trigger.expression}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vm.isPaused ? (
            <Button
              variant="outline"
              onClick={vm.mutations.resume.trigger}
              disabled={vm.mutations.resume.isPending}
            >
              {vm.mutations.resume.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Resume
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={vm.mutations.pause.trigger}
              disabled={!vm.isDeployed || vm.mutations.pause.isPending}
            >
              {vm.mutations.pause.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Pause
            </Button>
          )}
          <Button
            variant="accent"
            onClick={vm.mutations.run.trigger}
            disabled={!vm.canRun || vm.mutations.run.isPending}
          >
            {vm.mutations.run.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Run now
          </Button>
        </div>
      </header>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-3">
        <section className="flex flex-col gap-8 lg:col-span-2">
          <div>
            <Eyebrow tone="muted">Parameters</Eyebrow>
            <div className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border">
              {Object.entries(workflow.parameters).length === 0 ? (
                <div className="bg-card px-5 py-6 text-sm text-muted-foreground">
                  No parameters.
                </div>
              ) : (
                Object.entries(workflow.parameters).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between bg-card px-5 py-4">
                    <span className="text-sm font-medium text-muted-foreground">{k}</span>
                    <span className="font-mono text-sm tabular text-foreground">{String(v)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <Eyebrow tone="muted">Actions</Eyebrow>
            <ul className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border">
              {workflow.actions.map((a, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: actions have no stable id
                <li key={i} className="flex flex-col gap-1 bg-card px-5 py-4">
                  <span className="font-mono text-sm">
                    {a.contract}.{a.method}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    [{a.args.join(', ')}]
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Eyebrow tone="muted">Recent runs</Eyebrow>
            {vm.executionsLoading && vm.executions.length === 0 ? (
              <div className="mt-4 rounded-lg border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
                Loading run history…
              </div>
            ) : vm.executions.length === 0 ? (
              <div className="mt-4 rounded-lg border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
                No runs yet. Trigger one with “Run now”.
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border">
                {vm.executions.map((execution) => (
                  <li
                    key={execution.id}
                    className="flex items-center justify-between bg-card px-5 py-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-sm">
                        {execution.executionId.slice(0, 12)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular">
                        {new Date(execution.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <Badge variant="outline">{execution.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <StatTile label="Status" value={workflow.status} />
          {workflow.keeperJobId ? (
            <StatTile
              label="Keeper job"
              value={workflow.keeperJobId.slice(0, 8)}
              hint={
                vm.liveStatusLoading
                  ? 'fetching…'
                  : vm.liveStatus
                    ? `live: ${vm.liveStatus.status}`
                    : 'active'
              }
            />
          ) : (
            <StatTile label="Keeper job" value="—" hint="not deployed" />
          )}
          <StatTile
            label="Runs"
            value={String(workflow.runCount)}
            hint={
              workflow.lastRunAt
                ? `last ${new Date(workflow.lastRunAt).toLocaleString()}`
                : 'never run'
            }
          />

          <Separator />

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Owner</span>
              <MonoAddress address={workflow.owner} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Template</span>
              <span className="font-mono text-xs">{workflow.templateId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="tabular">{new Date(workflow.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={vm.mutations.fork.trigger}
            disabled={vm.mutations.fork.isPending}
          >
            {vm.mutations.fork.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Fork this workflow
          </Button>
        </aside>
      </div>
    </div>
  );
}
