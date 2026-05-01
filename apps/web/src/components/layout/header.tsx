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
        <Link to="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-base font-semibold tracking-tight text-foreground md:text-[1.05rem]">
            Loomlabs
          </span>
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
    <img
      src="/logo-transparent.png"
      alt=""
      aria-hidden
      className="h-8 w-8 object-contain md:h-9 md:w-9"
      loading="eager"
      decoding="async"
    />
  );
}
