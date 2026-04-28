import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type Toast, useToastStore } from '@/store/toast-store';

const variantClass: Record<Toast['variant'], string> = {
  default: 'border-border bg-card text-foreground',
  success: 'border-success/30 bg-success/5 text-foreground',
  destructive: 'border-destructive/30 bg-destructive/5 text-foreground',
  warning: 'border-warning/30 bg-warning/5 text-foreground',
};

function VariantIcon({ variant }: { variant: Toast['variant'] }) {
  const cls = 'h-4 w-4 shrink-0';
  if (variant === 'success') return <CheckCircle2 className={cn(cls, 'text-success')} />;
  if (variant === 'destructive') return <XCircle className={cn(cls, 'text-destructive')} />;
  if (variant === 'warning') return <TriangleAlert className={cn(cls, 'text-warning')} />;
  return <Info className={cn(cls, 'text-muted-foreground')} />;
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-md border p-4 shadow-md',
            'animate-fade-up backdrop-blur-sm',
            variantClass[t.variant],
          )}
        >
          <VariantIcon variant={t.variant} />
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">{t.title}</p>
            {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="text-muted-foreground transition-colors duration-std hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
