import { cn } from '@/lib/utils'

export function Logo({
  className,
  inverted = false,
}: {
  className?: string
  inverted?: boolean
}) {
  return (
    <span className={cn('inline-flex flex-col leading-none', className)}>
      <span
        className={cn(
          'text-[0.6rem] font-bold tracking-[0.3em] uppercase',
          inverted ? 'text-secondary-foreground/70' : 'text-muted-foreground',
        )}
      >
        PSSS presents
      </span>
      <span className="font-display text-2xl font-black tracking-tight uppercase">
        Fit<span className="text-primary">kid</span>rox
      </span>
    </span>
  )
}
