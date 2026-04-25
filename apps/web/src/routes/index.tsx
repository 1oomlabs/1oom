import { createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';

export const Route: AnyRoute = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="container py-16">
      <div className="flex flex-col gap-6 max-w-2xl">
        <h1 className="text-5xl font-bold tracking-tight">loomlabs</h1>
        <p className="text-lg text-muted-foreground">
          Natural language to DeFi workflow automation, with an agent marketplace that lets agents
          publish and consume workflows.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Create workflow
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Browse marketplace
          </button>
        </div>
      </div>
    </main>
  );
}
