import { Check, Film, Heart, ListPlus, Play } from 'lucide-react'
import type { Video } from '@/types'
import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'

export function Thumbnail({ video, className }: { video: Video; className?: string }) {
  if (!video.thumbnail) {
    return (
      <div className={cn('flex items-center justify-center bg-surface-2', className)}>
        <Film className="size-6 text-faint" aria-hidden="true" />
      </div>
    )
  }
  return (
    <img
      src={video.thumbnail}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn('object-cover', className)}
    />
  )
}

export function ProgressBar({ video, className }: { video: Video; className?: string }) {
  const fraction = video.completed
    ? 1
    : video.duration > 0
      ? Math.min(1, video.watchProgress / video.duration)
      : 0
  if (fraction <= 0.01) return null
  return (
    <div className={cn('h-1 w-full bg-white/15', className)}>
      <div
        className={cn('h-full', video.completed ? 'bg-white/50' : 'bg-accent')}
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  )
}

interface CardProps {
  video: Video
  onPlay: () => void
  onToggleFavorite?: () => void
  onQueue?: () => void
  queued?: boolean
  /** Rendered in the card's top-right on hover/focus (e.g. an overflow menu). */
  action?: React.ReactNode
  selected?: boolean
  onSelect?: () => void
}

export function VideoCard({
  video,
  onPlay,
  onToggleFavorite,
  onQueue,
  queued,
  action,
  selected,
  onSelect,
}: CardProps) {
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-card border bg-surface transition duration-200',
        'hover:-translate-y-0.5 hover:border-line hover:shadow-xl hover:shadow-black/30',
        selected ? 'border-accent' : 'border-line/60',
      )}
    >
      <button
        type="button"
        onClick={onSelect ?? onPlay}
        className="block w-full text-left"
        aria-label={`Play ${video.title}`}
      >
        <div className="relative aspect-[9/13] w-full overflow-hidden bg-bg-deep">
          <Thumbnail
            video={video}
            className="size-full transition duration-500 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />

          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg">
              <Play className="size-5 translate-x-px fill-current" aria-hidden="true" />
            </span>
          </span>

          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white/90 backdrop-blur-sm">
            {formatDuration(video.duration)}
          </span>

          {video.completed && (
            <span
              className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] text-white/85 backdrop-blur-sm"
              title="Watched"
            >
              <Check className="size-3" aria-hidden="true" />
              Watched
            </span>
          )}

          <ProgressBar video={video} className="absolute bottom-0 left-0" />
        </div>

        <div className="space-y-1 p-3">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{video.title}</h3>
          <p className="text-xs text-faint">{video.category}</p>
        </div>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
        {action}
        {onQueue && (
          <button
            type="button"
            onClick={onQueue}
            aria-label={queued ? `Remove ${video.title} from queue` : `Add ${video.title} to queue`}
            aria-pressed={queued}
            className={cn(
              'flex size-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition hover:bg-black/80',
              queued ? 'text-accent' : 'text-white/85',
            )}
          >
            <ListPlus className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={video.favorite ? `Unfavorite ${video.title}` : `Favorite ${video.title}`}
          aria-pressed={video.favorite}
          className={cn(
            'absolute left-2 flex size-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition hover:bg-black/80',
            video.completed ? 'top-10' : 'top-2',
            video.favorite ? 'text-accent opacity-100' : 'text-white/85 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Heart className={cn('size-4', video.favorite && 'fill-current')} aria-hidden="true" />
        </button>
      )}
    </article>
  )
}

interface RowProps {
  video: Video
  onPlay: () => void
  right?: React.ReactNode
  subtitle?: React.ReactNode
  index?: number
}

export function VideoRow({ video, onPlay, right, subtitle, index }: RowProps) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition hover:border-line/70 hover:bg-surface">
      {index !== undefined && (
        <span className="w-6 shrink-0 text-center text-xs tabular-nums text-faint">
          {String(index + 1).padStart(2, '0')}
        </span>
      )}
      <button
        type="button"
        onClick={onPlay}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={`Play ${video.title}`}
      >
        <span className="relative block aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-bg-deep sm:w-28">
          <Thumbnail video={video} className="size-full" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Play className="size-4 fill-current text-white" aria-hidden="true" />
          </span>
          <ProgressBar video={video} className="absolute bottom-0 left-0" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{video.title}</span>
          <span className="mt-0.5 block truncate text-xs text-faint">
            {subtitle ?? `${video.category} · ${formatDuration(video.duration)}`}
          </span>
        </span>
      </button>
      {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
    </div>
  )
}
