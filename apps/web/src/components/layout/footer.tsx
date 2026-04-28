const groups = [
  {
    label: 'Product',
    links: [
      { href: '/marketplace', label: 'Marketplace' },
      { href: '/workflows/new', label: 'Create workflow' },
      { href: '/agents', label: 'Agents' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { href: '#', label: 'Documentation' },
      { href: '#', label: 'GitHub' },
      { href: '#', label: 'Changelog' },
    ],
  },
  {
    label: 'Tracks',
    links: [
      { href: '#', label: 'KeeperHub' },
      { href: '#', label: 'ElizaOS' },
      { href: '#', label: 'Gensyn AXL' },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border bg-surface-subtle">
      <div className="container-wide grid grid-cols-2 gap-12 py-16 md:grid-cols-5">
        <div className="col-span-2">
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
                  <a
                    href={l.href}
                    className="text-foreground/80 transition-colors duration-std hover:text-foreground"
                  >
                    {l.label}
                  </a>
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
