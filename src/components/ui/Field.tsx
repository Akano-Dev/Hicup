import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

const control =
  'w-full rounded-xl border border-line bg-bg-deep px-3.5 py-2.5 text-sm text-text placeholder:text-faint ' +
  'transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25'

interface WrapProps {
  label: string
  hint?: string
  children: (id: string) => ReactNode
}

export function Field({ label, hint, children }: WrapProps) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wider text-faint">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  )
}

export function TextField({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} {...props} className={cn(control, className)} />}
    </Field>
  )
}

export function TextArea({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <textarea id={id} rows={3} {...props} className={cn(control, 'resize-y', className)} />}
    </Field>
  )
}

export function SelectField({
  label,
  hint,
  className,
  children,
  ...props
}: { label: string; hint?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select id={id} {...props} className={cn(control, 'appearance-none pr-9', className)}>
          {children}
        </select>
      )}
    </Field>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-6 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer size-0 opacity-0"
        />
        <span
          aria-hidden="true"
          className={cn(
            'block h-6 w-11 rounded-full transition duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg',
            checked ? 'bg-accent' : 'bg-line',
          )}
        >
          <span
            className={cn(
              'mt-0.5 ml-0.5 block size-5 rounded-full bg-white shadow transition duration-200',
              checked && 'translate-x-5',
            )}
          />
        </span>
      </span>
    </label>
  )
}
