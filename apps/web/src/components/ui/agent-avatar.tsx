import { cn } from '@/lib/utils';

interface AgentAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'idle' | 'offline';
}

const sizeClass: Record<NonNullable<AgentAvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

const statusClass: Record<NonNullable<AgentAvatarProps['status']>, string> = {
  online: 'bg-success',
  idle: 'bg-warning',
  offline: 'bg-muted-foreground',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
  ).toUpperCase();
}

export function AgentAvatar({
  name,
  src,
  size = 'md',
  status,
  className,
  ...props
}: AgentAvatarProps) {
  return (
    <div className={cn('relative inline-flex shrink-0', className)} {...props}>
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden rounded-full border border-border bg-surface-subtle font-display font-semibold text-foreground',
          sizeClass[size],
        )}
        aria-label={name}
      >
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="select-none">{initials(name)}</span>
        )}
      </div>
      {status && (
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
            statusClass[status],
          )}
        />
      )}
    </div>
  );
}
