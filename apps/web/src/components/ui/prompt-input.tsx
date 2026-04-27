import { type FormEvent, type KeyboardEvent, forwardRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PromptInputProps {
  className?: string;
  placeholder?: string;
  /** Initial value, applied on mount only. Parent updates after mount are ignored. */
  defaultValue?: string;
  submitLabel?: string;
  onSubmit?: (value: string) => void;
  examples?: string[];
}

export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(
  (
    {
      className,
      placeholder = 'Describe what you want to automate. e.g. "Every Friday, deposit 100 USDC into Aave."',
      defaultValue = '',
      submitLabel = 'Generate workflow',
      onSubmit,
      examples,
    },
    ref,
  ) => {
    const [value, setValue] = useState(defaultValue);

    const handleSubmit = (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;
      onSubmit?.(trimmed);
    };

    const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    };

    return (
      <form
        onSubmit={handleSubmit}
        className={cn(
          'group flex flex-col gap-3 rounded-xl border border-border bg-card p-4',
          'transition-colors duration-std ease-out-expo focus-within:border-foreground/30',
          className,
        )}
      >
        <textarea
          ref={ref}
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className={cn(
            'w-full resize-none border-0 bg-transparent px-1 py-1 text-base leading-relaxed text-foreground',
            'placeholder:text-muted-foreground focus:outline-none',
          )}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {examples?.slice(0, 3).map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setValue(ex)}
                className={cn(
                  'rounded-full border border-border bg-surface-subtle px-3 py-1 text-xs text-muted-foreground',
                  'transition-colors duration-std hover:border-foreground/30 hover:text-foreground',
                )}
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular">⌘ + Enter</span>
            <Button type="submit" variant="accent" size="md" disabled={!value.trim()}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    );
  },
);
PromptInput.displayName = 'PromptInput';
