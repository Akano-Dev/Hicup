import { useRef, useState } from 'react'
import {
  Captions,
  Heart,
  ListPlus,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { PlaybackApi } from '@/hooks/useVideoPlayback'
import type { Video } from '@/types'
import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'
import { IconButton } from '@/components/ui/Button'

interface Props {
  video: Video
  api: PlaybackApi | null
  muted: boolean
  favorite: boolean
  queued: boolean
  fullscreen: boolean
  position: { index: number; total: number }
  onToggleMute: () => void
  onToggleFavorite: () => void
  onToggleQueue: () => void
  onToggleFullscreen: () => void
  onMore: () => void
}

/** Scrubber doubles as the progress indicator; kept thin so video stays the focus. */
function Scrubber({ api }: { api: PlaybackApi | null }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const duration = api?.duration ?? 0
  const fraction = duration > 0 ? Math.min(1, (api?.currentTime ?? 0) / duration) : 0

  const seekFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || !api || !duration) return
    api.seek(((clientX - rect.left) / rect.width) * duration)
  }

  return (
    <div className="px-4 pb-1 pt-3 sm:px-6">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(api?.currentTime ?? 0)}
        aria-valuetext={`${formatDuration(api?.currentTime ?? 0)} of ${formatDuration(duration)}`}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            api?.seekBy(-5)
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            api?.seekBy(5)
          }
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setScrubbing(true)
          seekFromEvent(event.clientX)
        }}
        onPointerMove={(event) => scrubbing && seekFromEvent(event.clientX)}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
        className="group/track -my-2 cursor-pointer py-2 touch-none"
      >
        <div
          className={cn(
            'relative w-full rounded-full bg-white/20 transition-all duration-200',
            scrubbing ? 'h-1.5' : 'h-1 group-hover/track:h-1.5',
          )}
        >
          <div
            className="h-full rounded-full bg-[var(--c-accent)]"
            style={{ width: `${fraction * 100}%` }}
          />
          <span
            className={cn(
              'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-opacity',
              scrubbing ? 'opacity-100' : 'opacity-0 group-hover/track:opacity-100',
            )}
            style={{ left: `${fraction * 100}%` }}
          />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pb-3 text-[11px] tabular-nums text-white/55 sm:pb-5">
        <span>{formatDuration(api?.currentTime ?? 0)}</span>
        <span>{formatDuration(duration || 0)}</span>
      </div>
    </div>
  )
}

export function FeedOverlay({
  video,
  api,
  muted,
  favorite,
  queued,
  fullscreen,
  position,
  onToggleMute,
  onToggleFavorite,
  onToggleQueue,
  onToggleFullscreen,
  onMore,
}: Props) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-2/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
        aria-hidden="true"
      />

      {/* Control rail */}
      <div className="absolute bottom-28 right-3 z-40 flex flex-col items-center gap-2 sm:bottom-32 sm:right-5 lg:bottom-28">
        <IconButton
          label={api?.playing ? 'Pause' : 'Play'}
          onVideo
          onClick={() => api?.togglePlay()}
        >
          {api?.playing ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="size-5 translate-x-px fill-current" />
          )}
        </IconButton>
        <IconButton label={muted ? 'Unmute' : 'Mute'} onVideo onClick={onToggleMute}>
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </IconButton>
        <IconButton
          label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          onVideo
          active={favorite}
          onClick={onToggleFavorite}
        >
          <Heart className={cn('size-5', favorite && 'fill-current')} />
        </IconButton>
        <IconButton
          label={queued ? 'Remove from queue' : 'Add to queue'}
          onVideo
          active={queued}
          onClick={onToggleQueue}
        >
          <ListPlus className="size-5" />
        </IconButton>
        {api?.hasCaptions && (
          <IconButton
            label={api.captionsOn ? 'Hide captions' : 'Show captions'}
            onVideo
            active={api.captionsOn}
            onClick={api.toggleCaptions}
          >
            <Captions className="size-5" />
          </IconButton>
        )}
        <IconButton
          label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onVideo
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        </IconButton>
        <IconButton label="More options" onVideo onClick={onMore}>
          <MoreHorizontal className="size-5" />
        </IconButton>
      </div>

      {/* Metadata */}
      <div className="absolute inset-x-0 bottom-0 z-30 pad-safe-b">
        <div className="max-w-[calc(100%-4.5rem)] px-4 pb-1 sm:max-w-2xl sm:px-6">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
            {video.category} · {position.index + 1}/{position.total}
          </p>
          <h2 className="text-balance text-lg font-semibold leading-tight text-white drop-shadow sm:text-xl">
            {video.title}
          </h2>
          {video.description && (
            <p className="mt-1.5 line-clamp-2 text-sm text-white/70">{video.description}</p>
          )}
          {video.tags.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-white/55">
              {video.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </p>
          )}
        </div>
        <Scrubber api={api} />
      </div>
    </>
  )
}
