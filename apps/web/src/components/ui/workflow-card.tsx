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

function CardBody({ data }: { data: WorkflowCardData }) {
  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="self-start">
            {protocolLabel[data.protocol]}
          </Badge>
          <h3 className="font-display text-xl font-semibold tracking-tight text-balance">
            {data.name}
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
    'transition-colors duration-std ease-out-expo',
    linked && 'cursor-pointer hover:border-foreground/30',
    className,
  );

  if (linked) {
    return (
      <Link to="/workflows/$id" params={{ id: data.id }} className={baseClass}>
        <CardBody data={data} />
      </Link>
    );
  }

  return (
    <div className={baseClass}>
      <CardBody data={data} />
    </div>
  );
}
