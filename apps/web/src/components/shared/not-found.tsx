import { Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';

export function NotFoundView() {
  return (
    <div className="container-wide flex min-h-[70vh] flex-col items-start justify-center gap-10 py-16 md:py-24">
      <div className="flex flex-col gap-3">
        <Eyebrow tone="accent">404 · route not woven</Eyebrow>
        <h1 className="font-display text-6xl font-semibold tracking-tight text-balance md:text-7xl">
          We couldn’t find that page.
        </h1>
        <p className="max-w-prose text-muted-foreground">
          The address may have been mistyped, the workflow may have been removed, or the listing may
          not have been published yet. Pick somewhere to go next.
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
        <NavTile to="/" eyebrow="Home" title="Start over" hint="Project intro and live links." />
        <NavTile
          to="/marketplace"
          eyebrow="Marketplace"
          title="Browse workflows"
          hint="Free and x402-priced automations."
        />
        <NavTile
          to="/workflows/new"
          eyebrow="Create"
          title="Compile a new workflow"
          hint="Type, compile, deploy."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" asChild>
          <Link to="/">Take me home</Link>
        </Button>
        <Button variant="outline" size="md" asChild>
          <Link to="/marketplace">Open the marketplace</Link>
        </Button>
      </div>
    </div>
  );
}

function NavTile({
  to,
  eyebrow,
  title,
  hint,
}: {
  to: '/' | '/marketplace' | '/workflows/new';
  eyebrow: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-2 bg-card p-5 transition-colors duration-std ease-out-expo hover:bg-surface-subtle"
    >
      <Eyebrow tone="muted">{eyebrow}</Eyebrow>
      <span className="font-display text-lg font-semibold tracking-tight text-balance transition-colors duration-std ease-out-expo group-hover:text-accent">
        {title}
        <span
          aria-hidden
          className="ml-1 inline-block translate-x-0 text-accent opacity-0 transition-[opacity,transform] duration-std ease-out-expo group-hover:translate-x-1 group-hover:opacity-100"
        >
          →
        </span>
      </span>
      <span className="text-sm text-muted-foreground">{hint}</span>
    </Link>
  );
}
