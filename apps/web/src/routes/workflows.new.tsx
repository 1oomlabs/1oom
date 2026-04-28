import { createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PromptInput } from '@/components/ui/prompt-input';
import { Separator } from '@/components/ui/separator';
import { promptExamples } from '@/lib/mock';

export const Route: AnyRoute = createFileRoute('/workflows/new')({
  component: WorkflowBuilderPage,
});

function WorkflowBuilderPage() {
  const [prompt, setPrompt] = useState('');
  const [extracted, setExtracted] = useState<null | {
    templateId: string;
    confidence: number;
    parameters: Record<string, string>;
  }>(null);

  const handleSubmit = (value: string) => {
    setPrompt(value);
    // Mock LLM extraction result
    setExtracted({
      templateId: 'aave-recurring-deposit',
      confidence: 0.92,
      parameters: {
        token: 'USDC (0xA0b8…eB48)',
        amount: '100',
        interval: '7d',
        maxIterations: '52',
      },
    });
  };

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
        {/* Left: prompt + steps */}
        <section className="lg:col-span-3">
          <div className="flex flex-col gap-6">
            <PromptInput
              examples={promptExamples}
              defaultValue={prompt}
              onSubmit={handleSubmit}
              submitLabel="Compile workflow"
            />

            <Separator className="my-2" />

            <ol className="flex flex-col gap-4 text-sm">
              {[
                {
                  done: !!prompt,
                  title: 'Describe in plain language',
                  hint: 'Tip: include the protocol, frequency, amount, and chain.',
                },
                {
                  done: !!extracted,
                  title: 'Match a template',
                  hint: 'We pick the closest from Aave, Uniswap, Lido, or custom.',
                },
                {
                  done: false,
                  title: 'Review parameters',
                  hint: 'Adjust anything the model got wrong before deploying.',
                },
                {
                  done: false,
                  title: 'Deploy to KeeperHub',
                  hint: 'Optional: publish to the marketplace with x402 pricing.',
                },
              ].map((step) => (
                <li
                  key={step.title}
                  className="flex items-start gap-4 border border-border bg-card p-4"
                >
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      step.done
                        ? 'border-success bg-success text-success-foreground'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {step.done ? '✓' : ''}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{step.title}</span>
                    <span className="text-muted-foreground">{step.hint}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Right: preview */}
        <aside className="lg:col-span-2">
          <div className="sticky top-24 flex flex-col gap-4 border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <Eyebrow tone="muted">Preview</Eyebrow>
              {extracted && (
                <Badge variant="success">
                  {(extracted.confidence * 100).toFixed(0)}% confident
                </Badge>
              )}
            </div>

            {!extracted ? (
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
                  <span className="font-mono text-sm">{extracted.templateId}</span>
                </div>

                <Separator />

                <div className="flex flex-col gap-3">
                  {Object.entries(extracted.parameters).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1.5">
                      <Label htmlFor={`p-${k}`}>{k}</Label>
                      <Input id={`p-${k}`} defaultValue={v} className="font-mono text-xs" />
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <Button variant="accent" size="lg">
                    Deploy to KeeperHub
                  </Button>
                  <Button variant="outline" size="md">
                    Save as draft
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
