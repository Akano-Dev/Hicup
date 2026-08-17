import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-faint">
        {icon}
      </div>
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mb-10', className)}>
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-faint">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Chip({
  active,
  children,
  ...props
}: { active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition duration-200',
        active
          ? 'border-accent bg-accent text-on-accent font-medium'
          : 'border-line text-muted hover:border-faint hover:text-text',
      )}
    >
      {children}
    </button>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-card border border-line/70 bg-surface px-4 py-3.5">
      <div className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wider text-faint">{label}</div>
    </div>
  )
}

/** Horizontally scrolling shelf used across Home and collection pages. */
export function Shelf({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {children}
    </div>
  )
}
