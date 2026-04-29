import { zodResolver } from '@hookform/resolvers/zod';
import { type KeyboardEvent, forwardRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const promptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, { message: 'Prompt must be at least 3 characters.' })
    .max(500, { message: 'Prompt is too long (max 500 characters).' }),
});

type PromptForm = z.infer<typeof promptSchema>;

interface PromptInputProps {
  className?: string;
  placeholder?: string;

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
    const form = useForm<PromptForm>({
      resolver: zodResolver(promptSchema),
      mode: 'onChange',
      defaultValues: { prompt: defaultValue },
    });

    // Keep form in sync with defaultValue when navigated back to page.
    // form is stable across renders so its method refs don't drive re-runs.
    const setValue = form.setValue;
    const getValues = form.getValues;
    useEffect(() => {
      if (defaultValue && defaultValue !== getValues('prompt')) {
        setValue('prompt', defaultValue, { shouldValidate: true });
      }
    }, [defaultValue, setValue, getValues]);

    const value = form.watch('prompt');
    const error = form.formState.errors.prompt;

    const submit = form.handleSubmit((data) => {
      onSubmit?.(data.prompt);
    });

    const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        void submit();
      }
    };

    const { ref: registerRef, ...promptField } = form.register('prompt');

    return (
      <form
        onSubmit={submit}
        className={cn(
          'group flex flex-col gap-3 rounded-xl border border-border bg-card p-4',
          'transition-colors duration-std ease-out-expo focus-within:border-foreground/30',
          error && 'border-destructive/40',
          className,
        )}
      >
        <textarea
          {...promptField}
          ref={(el) => {
            registerRef(el);
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          }}
          rows={3}
          onKeyDown={handleKey}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'prompt-error' : undefined}
          className={cn(
            'w-full resize-none border-0 bg-transparent px-1 py-1 text-base leading-relaxed text-foreground',
            'placeholder:text-muted-foreground focus:outline-none',
          )}
        />

        {error && (
          <p id="prompt-error" className="text-xs text-destructive">
            {error.message}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {examples?.slice(0, 3).map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => form.setValue('prompt', ex, { shouldValidate: true })}
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
            <Button
              type="submit"
              variant="accent"
              size="md"
              disabled={!value || !value.trim() || !!error}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    );
  },
);
PromptInput.displayName = 'PromptInput';
