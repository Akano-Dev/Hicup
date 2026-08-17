import { cn } from '@/utils/cn'

/**
 * App mark. Served from /public so the same asset backs the browser tab icon.
 * Square-cropped at build time, hence object-cover rather than any letterboxing.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden="true"
      width={512}
      height={512}
      className={cn('rounded-lg object-cover', className)}
    />
  )
}
