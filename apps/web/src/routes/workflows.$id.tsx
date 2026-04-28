import { Link, createFileRoute, useParams } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

import {
  useForkWorkflow,
  usePauseWorkflow,
  useResumeWorkflow,
  useRunWorkflow,
  useWorkflow,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { MonoAddress } from '@/components/ui/mono-address';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { protocolFromTemplateId } from '@/lib/view-models';
import { toast } from '@/store/toast-store';

export const Route: AnyRoute = createFileRoute('/workflows/$id')({
  component: WorkflowDetailPage,
});

function WorkflowDetailPage() {
  const { id } = useParams({ from: '/workflows/$id' });
  const { data: workflow, isLoading, isError, error, refetch } = useWorkflow(id);

  const runM = useRunWorkflow({
    onSuccess: ({ execution }) =>
      toast.success('Run triggered', `Execution ${execution.executionId}`),
    onError: (e) => toast.error('Run failed', e.message),
  });
  const pauseM = usePauseWorkflow({
    onSuccess: () => toast.info('Workflow paused'),
    onError: (e) => toast.error('Pause failed', e.message),
  });
  const resumeM = useResumeWorkflow({
    onSuccess: () => toast.success('Workflow resumed'),
    onError: (e) => toast.error('Resume failed', e.message),
  });
  const forkM = useForkWorkflow({
    onSuccess: (forked) => toast.success('Forked', `New id: ${forked.id.slice(0, 8)}`),
    onError: (e) => toast.error('Fork failed', e.message),
  });

  if (isLoading) {
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

  if (isError || !workflow) {
    return (
      <div className="container-wide py-24">
        <div className="flex flex-col items-center gap-4 border border-dashed border-destructive/40 bg-destructive/5 py-16 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight">Workflow not found</p>
          <p className="max-w-prose text-sm text-muted-foreground">
            {error?.message ?? `No workflow with id ${id}`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/marketplace">Back to marketplace</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const protocol = protocolFromTemplateId(workflow.templateId);
  const protocolLabel = protocol.charAt(0).toUpperCase() + protocol.slice(1);
  const statusVariant = {
    deployed: 'success',
    completed: 'success',
    paused: 'warning',
    error: 'destructive',
    draft: 'ghost',
  } as const;

  const isDeployed = workflow.status === 'deployed';
  const isPaused = workflow.status === 'paused';
  const canRun = isDeployed && !!workflow.keeperJobId;

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
            <Badge variant={statusVariant[workflow.status]}>{workflow.status.toUpperCase()}</Badge>
            <Badge variant="outline">{protocolLabel}</Badge>
            <Badge variant="outline">Chain {workflow.chainId}</Badge>
            {workflow.trigger.type === 'cron' && (
              <span className="text-sm text-muted-foreground">
                cron · {workflow.trigger.expression}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button
              variant="outline"
              onClick={() => resumeM.mutate(workflow.id)}
              disabled={resumeM.isPending}
            >
              {resumeM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Resume
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => pauseM.mutate(workflow.id)}
              disabled={!isDeployed || pauseM.isPending}
            >
              {pauseM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Pause
            </Button>
          )}
          <Button
            variant="accent"
            onClick={() => runM.mutate(workflow.id)}
            disabled={!canRun || runM.isPending}
          >
            {runM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
        </section>

        <aside className="flex flex-col gap-6">
          <StatTile label="Status" value={workflow.status} />
          {workflow.keeperJobId ? (
            <StatTile label="Keeper job" value={workflow.keeperJobId.slice(0, 8)} hint="active" />
          ) : (
            <StatTile label="Keeper job" value="—" hint="not deployed" />
          )}

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
            onClick={() => forkM.mutate(workflow.id)}
            disabled={forkM.isPending}
          >
            {forkM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Fork this workflow
          </Button>
        </aside>
      </div>
    </div>
  );
}
