import { createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PromptInput } from '@/components/ui/prompt-input';
import { Separator } from '@/components/ui/separator';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { useWorkflowBuilderVM } from '@/hooks/page/use-workflow-builder-vm';

export const Route: AnyRoute = createFileRoute('/workflows/new')({
  component: WorkflowBuilderPage,
});

type BuilderVM = ReturnType<typeof useWorkflowBuilderVM>;

function WorkflowBuilderPage() {
  const vm = useWorkflowBuilderVM();

  return (
    <div className="container-wide py-16 md:py-24">
      <header className="mb-10 flex flex-col gap-3">
        <Eyebrow tone="accent">Create workflow</Eyebrow>
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Type. Compile. Deploy.
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Describe what you want to automate. We will match it against the template catalog, extract
          parameters, and prepare a workflow you can review.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="flex flex-col gap-6">
            <PromptInput
              examples={vm.examples}
              defaultValue={vm.prompt}
              onSubmit={vm.handlers.onCompile}
              submitLabel={vm.isCompiling ? 'Compiling…' : 'Compile workflow'}
            />

            <Separator className="my-2" />

            <ol className="flex flex-col gap-4 text-sm">
              <Step
                done={!!vm.prompt}
                title="Describe in plain language"
                hint="Tip: include the protocol, frequency, amount, and chain."
              />
              <Step
                done={!!vm.intent}
                inProgress={vm.isCompiling}
                title="Match a template"
                hint="We pick the closest from Aave, Uniswap, Lido, or custom."
              />
              <Step
                done={false}
                title="Review parameters"
                hint="Adjust anything the model got wrong before deploying."
              />
              <Step
                done={false}
                inProgress={vm.isDeploying}
                title="Deploy & publish"
                hint="Deploys to KeeperHub and lists the workflow on the marketplace as free."
              />
            </ol>
          </div>
        </section>

        <aside className="lg:col-span-2">
          <div className="sticky top-24 flex flex-col gap-4 border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <Eyebrow tone="muted">Preview</Eyebrow>
              {vm.intent && (
                <Badge variant="success">
                  {(vm.intent.confidence * 100).toFixed(0)}% confident
                </Badge>
              )}
            </div>

            {vm.isCompiling ? (
              <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting intent…
              </div>
            ) : !vm.intent ? (
              <div className="flex flex-col items-start gap-2 py-8 text-sm text-muted-foreground">
                <span className="font-mono text-xs uppercase tracking-[0.14em]">
                  awaiting prompt
                </span>
                <p>Submit a description on the left. The compiled workflow will appear here.</p>
              </div>
            ) : (
              <PreviewPanel vm={vm} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PreviewPanel({ vm }: { vm: BuilderVM }) {
  if (!vm.intent) return null;
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Template
        </span>
        <span className="font-mono text-sm">{vm.intent.templateId}</span>
      </div>

      {vm.intent.reasoning && (
        <p className="text-sm text-muted-foreground">{vm.intent.reasoning}</p>
      )}

      <Separator />

      <div className="flex flex-col gap-3">
        {Object.entries(vm.resolvedParameters).map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1.5">
            <Label htmlFor={`p-${k}`}>{k}</Label>
            <Input
              id={`p-${k}`}
              defaultValue={String(v ?? '')}
              onChange={(e) => vm.handlers.onParamChange(k, e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        ))}
      </div>

      <Separator />

      {!vm.isWalletConnected ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Connect a wallet to deploy. The wallet address becomes the workflow owner.
          </p>
          <ConnectWalletButton />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="accent"
            size="lg"
            onClick={vm.handlers.onDeploy}
            disabled={vm.isDeploying}
          >
            {vm.isDeploying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deploying…
              </>
            ) : (
              'Deploy & publish'
            )}
          </Button>
          <Button type="button" variant="outline" size="md" onClick={vm.handlers.onReset}>
            Discard draft
          </Button>
        </div>
      )}
    </>
  );
}

function Step({
  done,
  inProgress,
  title,
  hint,
}: {
  done: boolean;
  inProgress?: boolean;
  title: string;
  hint: string;
}) {
  return (
    <li className="flex items-start gap-4 border border-border bg-card p-4">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          done
            ? 'border-success bg-success text-success-foreground'
            : inProgress
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted-foreground'
        }`}
      >
        {done ? '✓' : inProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : ''}
      </span>
      <div className="flex flex-col gap-1">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{hint}</span>
      </div>
    </li>
  );
}
