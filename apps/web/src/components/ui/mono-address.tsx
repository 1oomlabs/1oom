import { cn } from '@/lib/utils';

interface MonoAddressProps extends React.HTMLAttributes<HTMLSpanElement> {
  address: string;
  /** Truncate as 0x1234...abcd */
  truncate?: boolean;
}

function shorten(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function MonoAddress({ address, truncate = true, className, ...props }: MonoAddressProps) {
  const shown = truncate ? shorten(address) : address;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-xs text-muted-foreground',
        className,
      )}
      title={address}
      {...props}
    >
      {shown}
    </span>
  );
}
