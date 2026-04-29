import { Check, ChevronDown, Copy, LogOut, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { COPIED_RESET_MS, SUPPORTED_CHAINS, chainLabel, shortenAddress } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ConnectWalletButton({ className }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current != null) clearTimeout(copiedTimeoutRef.current);
    },
    [],
  );

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={cn('gap-2 font-mono text-xs', className)}>
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            <span className="tabular">{shortenAddress(address)}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Wallet</DropdownMenuLabel>
          <div className="px-2 pb-2 pt-1">
            <p className="select-all break-all font-mono text-xs leading-relaxed tabular text-foreground">
              {address}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{chainLabel(chainId)}</p>
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Switch chain</DropdownMenuLabel>
          {SUPPORTED_CHAINS.map((c) => (
            <DropdownMenuItem
              key={c.id}
              disabled={switching || c.id === chainId}
              onSelect={(e) => {
                e.preventDefault();
                if (c.id !== chainId) switchChain({ chainId: c.id });
              }}
            >
              <span className="flex-1">{c.label}</span>
              {c.id === chainId && <Check className="h-3.5 w-3.5 text-success" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async (e) => {
              e.preventDefault();
              await navigator.clipboard.writeText(address);
              setCopied(true);
              if (copiedTimeoutRef.current != null) clearTimeout(copiedTimeoutRef.current);
              copiedTimeoutRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
            }}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-3.5 w-3.5 text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy address
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              disconnect();
            }}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm" className={className}>
          <Wallet className="h-3.5 w-3.5" />
          Connect wallet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
          <DialogDescription>
            Pick a connector. We support Sepolia (default) and Ethereum mainnet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {connectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              disabled={connecting}
              onClick={() => connect({ connector: c }, { onSuccess: () => setOpen(false) })}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 text-left',
                'transition-colors duration-std hover:border-foreground/30 hover:bg-secondary',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              <div className="flex items-center gap-3">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{c.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{c.type}</span>
            </button>
          ))}
        </div>

        {connectError && <p className="mt-2 text-sm text-destructive">{connectError.message}</p>}
      </DialogContent>
    </Dialog>
  );
}
