import { Link } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { MonoAddress } from '@/components/ui/mono-address';
import { cn } from '@/lib/utils';

export interface WorkflowCardData {
  id: string;
  name: string;
  description: string;
  protocol: 'aave' | 'uniswap' | 'lido' | 'custom';
  author: string;
  price?: { amount: string; token: string } | 'free';
  installs: number;
  runs: number;
  verified?: {
    status: 'pending' | 'confirmed';
    txHash: string;
    explorerUrl: string;
  };
  axlAgent?: boolean;
}

const protocolLabel: Record<WorkflowCardData['protocol'], string> = {
  aave: 'Aave',
  uniswap: 'Uniswap',
  lido: 'Lido',
  custom: 'Custom',
};

interface WorkflowCardProps {
  data: WorkflowCardData;
  className?: string;

  linked?: boolean;
}

function CardBody({ data, linked }: { data: WorkflowCardData; linked: boolean }) {
  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{protocolLabel[data.protocol]}</Badge>
            {data.verified && (
              <Badge variant={data.verified.status === 'confirmed' ? 'success' : 'warning'}>
                {data.verified.status === 'confirmed' ? 'Verified on Sepolia' : 'Onchain pending'}
              </Badge>
            )}
            {data.axlAgent && <Badge variant="accent">via AXL agent</Badge>}
          </div>
          <h3 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-balance transition-colors duration-std ease-out-expo group-hover:text-accent">
            <span>{data.name}</span>
            {linked && (
              <span
                aria-hidden
                className="translate-x-0 text-accent opacity-0 transition-[opacity,transform] duration-std ease-out-expo group-hover:translate-x-1 group-hover:opacity-100"
              >
                →
              </span>
            )}
          </h3>
        </div>
        {data.price && (
          <div className="text-right text-sm">
            {data.price === 'free' ? (
              <span className="text-muted-foreground">Free</span>
            ) : (
              <span className="font-mono tabular text-foreground">
                {data.price.amount} {data.price.token}
              </span>
            )}
          </div>
        )}
      </header>

      <p className="line-clamp-2 text-sm text-muted-foreground">{data.description}</p>

      <footer className="mt-auto flex items-center justify-between gap-3 pt-2">
        <MonoAddress address={data.author} />
        <div className="flex items-center gap-3 text-xs tabular text-muted-foreground">
          <span>{data.installs.toLocaleString()} installs</span>
          <span aria-hidden>·</span>
          <span>{data.runs.toLocaleString()} runs</span>
        </div>
      </footer>
    </>
  );
}

export function WorkflowCard({ data, className, linked = true }: WorkflowCardProps) {
  const baseClass = cn(
    'group flex flex-col gap-5 border border-border bg-card p-6',
    'transition-[border-color,background-color] duration-std ease-out-expo',
    linked && 'cursor-pointer hover:border-foreground/40 hover:bg-surface-subtle',
    className,
  );

  if (linked) {
    return (
      <Link to="/workflows/$id" params={{ id: data.id }} className={baseClass}>
        <CardBody data={data} linked />
      </Link>
    );
  }

  return (
    <div className={baseClass}>
      <CardBody data={data} linked={false} />
    </div>
  );
}
