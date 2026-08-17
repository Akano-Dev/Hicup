import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'

interface Props {
  remaining: number
  planned: number
}

/** Deliberately quiet: a ring and a number, no urgency cues. */
export function SessionTimer({ remaining, planned }: Props) {
  const fraction = planned > 0 ? Math.max(0, Math.min(1, remaining / planned)) : 0
  const circumference = 2 * Math.PI * 9
  const nearlyDone = planned > 0 && remaining <= 60

  return (
    <div
      className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white/75 backdrop-blur-md"
      role="timer"
      aria-label={`${formatDuration(remaining)} remaining in this session`}
    >
      <svg viewBox="0 0 22 22" className="size-4 -rotate-90" aria-hidden="true">
        <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <circle
          cx="11"
          cy="11"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cn('transition-[stroke-dashoffset] duration-1000 ease-linear', nearlyDone && 'text-[var(--c-accent)]')}
        />
      </svg>
      <span className="tabular-nums">{formatDuration(remaining)} left</span>
    </div>
  )
}
