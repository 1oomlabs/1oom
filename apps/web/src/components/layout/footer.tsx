import { Link } from '@tanstack/react-router';

type RouteHref = '/marketplace' | '/workflows/new' | '/agents';

interface InternalLink {
  type: 'route';
  to: RouteHref;
  label: string;
}

interface PlaceholderLink {
  type: 'placeholder';
  label: string;
}

type FooterLink = InternalLink | PlaceholderLink;

interface FooterGroup {
  label: string;
  links: FooterLink[];
}

const groups: FooterGroup[] = [
  {
    label: 'Product',
    links: [
      { type: 'route', to: '/marketplace', label: 'Marketplace' },
      { type: 'route', to: '/workflows/new', label: 'Create workflow' },
      { type: 'route', to: '/agents', label: 'Agents' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { type: 'placeholder', label: 'Documentation' },
      { type: 'placeholder', label: 'GitHub' },
      { type: 'placeholder', label: 'Changelog' },
    ],
  },
  {
    label: 'Tracks',
    links: [
      { type: 'placeholder', label: 'KeeperHub' },
      { type: 'placeholder', label: 'ElizaOS' },
      { type: 'placeholder', label: 'Gensyn AXL' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border bg-surface-subtle">
      <div className="container-wide grid grid-cols-2 gap-12 py-16 md:grid-cols-5">
        <div className="col-span-2">
          <div className="mb-4 inline-flex items-center gap-2.5">
            <img
              src="/logo-transparent.png"
              alt=""
              aria-hidden
              className="h-7 w-7 object-contain"
              loading="lazy"
              decoding="async"
            />
            <span className="font-display text-lg font-semibold tracking-tight">Loomlabs</span>
          </div>
          <p className="font-display text-2xl font-semibold tracking-tight text-balance">
            From a sentence to a deployed DeFi automation.
          </p>
          <p className="mt-3 max-w-prose text-sm text-muted-foreground">
            loomlabs is a workflow marketplace where humans and agents publish, discover, and remix
            automations that run on KeeperHub.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {g.label}
            </span>
            <ul className="flex flex-col gap-2 text-sm">
              {g.links.map((l) => (
                <li key={`${g.label}-${l.label}`}>
                  {l.type === 'route' ? (
                    <Link
                      to={l.to}
                      className="text-foreground/80 transition-colors duration-std hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="cursor-default text-muted-foreground/60"
                      title="Coming soon"
                    >
                      {l.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container-wide flex flex-col items-start justify-between gap-3 py-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <span>© 2026 loomlabs. Built for ETHGlobal.</span>
          <span className="font-mono tabular">v0.0.0 · 1oomlabs</span>
        </div>
      </div>
    </footer>
  );
}
