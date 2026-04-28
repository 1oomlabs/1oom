import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';

import { type CreateWorkflowRequest, useCreateWorkflow, useExtractIntent } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PromptInput } from '@/components/ui/prompt-input';
import { Separator } from '@/components/ui/separator';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { DEFAULT_CHAIN_ID } from '@/lib/wagmi';
import { useDraftStore } from '@/store/draft-store';
import { toast } from '@/store/toast-store';

const promptExamples = [
  'Every Friday, deposit 100 USDC into Aave',
  'Buy 0.05 ETH each Monday with USDC on Uniswap',
  'Stake 1 ETH into Lido and compound stETH monthly',
];

export const Route: AnyRoute = createFileRoute('/workflows/new')({
  component: WorkflowBuilderPage,
});

function WorkflowBuilderPage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const prompt = useDraftStore((s) => s.prompt);
  const intent = useDraftStore((s) => s.intent);
  const overrides = useDraftStore((s) => s.overrides);
  const setPrompt = useDraftStore((s) => s.setPrompt);
  const setIntent = useDraftStore((s) => s.setIntent);
  const setOverride = useDraftStore((s) => s.setOverride);
  const reset = useDraftStore((s) => s.reset);

  const extract = useExtractIntent({
    onSuccess: ({ intent: extracted }) => {
      setIntent(extracted);
    },
    onError: (err) => {
      toast.error('Could not extract intent', err.message);
    },
  });

  const create = useCreateWorkflow<CreateWorkflowRequest>({
    onSuccess: (workflow) => {
      toast.success('Workflow deployed', `Job ${workflow.id.slice(0, 8)} on KeeperHub`);
      reset();
      navigate({ to: '/workflows/$id', params: { id: workflow.id } });
    },
    onError: (err) => {
      toast.error('Deploy failed', err.message);
    },
  });

  const handleCompile = (value: string) => {
    setPrompt(value);
    extract.mutate({ prompt: value });
  };

  const handleDeploy = () => {
    if (!isConnected || !address) {
      toast.warning('Connect a wallet first', 'Workflows are owned by your wallet address.');
      return;
    }
    if (!prompt) return;
    create.mutate({
      prompt,
      owner: address,
      chainId: chainId ?? DEFAULT_CHAIN_ID,
    });
  };

  const resolvedParameters = { ...(intent?.parameters ?? {}), ...overrides };

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
              examples={promptExamples}
              defaultValue={prompt}
              onSubmit={handleCompile}
              submitLabel={extract.isPending ? 'Compiling…' : 'Compile workflow'}
            />

            <Separator className="my-2" />

            <ol className="flex flex-col gap-4 text-sm">
              <Step
                done={!!prompt}
                title="Describe in plain language"
                hint="Tip: include the protocol, frequency, amount, and chain."
              />
              <Step
                done={!!intent}
                inProgress={extract.isPending}
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
                inProgress={create.isPending}
                title="Deploy to KeeperHub"
                hint="Optional: publish to the marketplace with x402 pricing."
              />
            </ol>
          </div>
        </section>

        <aside className="lg:col-span-2">
          <div className="sticky top-24 flex flex-col gap-4 border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <Eyebrow tone="muted">Preview</Eyebrow>
              {intent && (
                <Badge variant="success">{(intent.confidence * 100).toFixed(0)}% confident</Badge>
              )}
            </div>

            {extract.isPending ? (
              <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting intent…
              </div>
            ) : !intent ? (
              <div className="flex flex-col items-start gap-2 py-8 text-sm text-muted-foreground">
                <span className="font-mono text-xs uppercase tracking-[0.14em]">
                  awaiting prompt
                </span>
                <p>Submit a description on the left. The compiled workflow will appear here.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Template
                  </span>
                  <span className="font-mono text-sm">{intent.templateId}</span>
                </div>

                {intent.reasoning && (
                  <p className="text-sm text-muted-foreground">{intent.reasoning}</p>
                )}

                <Separator />

                <div className="flex flex-col gap-3">
                  {Object.entries(resolvedParameters).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1.5">
                      <Label htmlFor={`p-${k}`}>{k}</Label>
                      <Input
                        id={`p-${k}`}
                        defaultValue={String(v ?? '')}
                        onChange={(e) => setOverride(k, e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>

                <Separator />

                {!isConnected ? (
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
                      onClick={handleDeploy}
                      disabled={create.isPending}
                    >
                      {create.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Deploying…
                        </>
                      ) : (
                        'Deploy to KeeperHub'
                      )}
                    </Button>
                    <Button type="button" variant="outline" size="md" onClick={() => reset()}>
                      Discard draft
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
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
