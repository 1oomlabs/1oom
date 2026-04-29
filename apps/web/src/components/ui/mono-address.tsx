import { shortenAddress } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface MonoAddressProps extends React.HTMLAttributes<HTMLSpanElement> {
  address: string;

  truncate?: boolean;
}

export function MonoAddress({ address, truncate = true, className, ...props }: MonoAddressProps) {
  const shown = truncate ? shortenAddress(address) : address;
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
