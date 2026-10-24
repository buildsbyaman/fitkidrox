import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Label + control + hint/error, with ids wired for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** aria props for a control rendered inside <Field>. */
export function fieldAria(id: string, error?: string, hasHint = false) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error
      ? `${id}-error`
      : hasHint
        ? `${id}-hint`
        : undefined,
  }
}

export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="track-lines border-b border-border/80 bg-muted/20">
      <div className="mx-auto max-w-content px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-sm font-bold tracking-[0.25em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="font-display mt-3 max-w-3xl text-6xl leading-[0.85] font-black uppercase sm:text-7xl">
          {title}
        </h1>
        {children && (
          <div className="mt-5 max-w-2xl text-lg text-muted-foreground">
            {children}
          </div>
        )}
      </div>
    </section>
  )
}
