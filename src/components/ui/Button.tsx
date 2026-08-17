import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110 active:brightness-95 font-semibold',
  secondary: 'bg-surface-2 text-text hover:bg-line',
  outline: 'border border-line text-text hover:bg-surface-2',
  ghost: 'text-muted hover:text-text hover:bg-surface-2',
  danger: 'bg-danger/12 text-danger hover:bg-danger/20',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-14 px-7 text-base gap-2.5 rounded-2xl',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition duration-200',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
    />
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  /** Translucent style for use directly on top of video. */
  onVideo?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const iconSizes = { sm: 'size-9', md: 'size-11', lg: 'size-14' }

export function IconButton({
  label,
  active,
  onVideo,
  size = 'md',
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-full transition duration-200',
        'disabled:pointer-events-none disabled:opacity-40',
        iconSizes[size],
        onVideo
          ? 'text-white/90 backdrop-blur-md hover:bg-white/15 active:scale-95'
          : 'text-muted hover:bg-surface-2 hover:text-text',
        onVideo && !active && 'bg-black/35',
        active && (onVideo ? 'bg-accent text-on-accent' : 'text-accent'),
        className,
      )}
    />
  )
}
