import { Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { cn } from '@/lib/utils';

const navLinkClass = cn(
  'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground',
  'transition-colors duration-std hover:text-foreground',
  '[&.active]:text-foreground',
);

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container-wide flex h-16 items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-base font-semibold tracking-tight">loomlabs</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link to="/marketplace" className={navLinkClass} activeProps={{ className: 'active' }}>
            Marketplace
          </Link>
          <Link to="/workflows/new" className={navLinkClass} activeProps={{ className: 'active' }}>
            Create
          </Link>
          <Link to="/agents" className={navLinkClass} activeProps={{ className: 'active' }}>
            Agents
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link to="/workflows/new">New</Link>
          </Button>
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="relative inline-flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background"
    >
      <span className="font-display text-sm font-bold leading-none">L</span>
      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" />
    </span>
  );
}
