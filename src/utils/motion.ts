import { useSettings } from '@/store/settings'

/** True when either the OS or the in-app setting asks for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return (
    useSettings.getState().reducedMotion ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
