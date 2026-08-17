import { useEffect, useRef } from 'react'
import { AlertTriangle, Play } from 'lucide-react'
import { useMediaUrl } from '@/hooks/useMediaUrl'
import { useVideoPlayback, type PlaybackApi } from '@/hooks/useVideoPlayback'
import { useSettings } from '@/store/settings'
import type { Video } from '@/types'
import { cn } from '@/utils/cn'

interface Props {
  video: Video
  active: boolean
  /** Inside the render window: mount the media element and preload. */
  near: boolean
  /**
   * Publishes the live playback API to a parent-held ref for keyboard
   * shortcuts. Deliberately a ref write rather than parent state — the API
   * object changes identity on every render, and lifting it would loop.
   */
  publishApi?: (api: PlaybackApi | null) => void
  /** The overlay renders inside the stage so it always sees the current API. */
  renderOverlay?: (api: PlaybackApi) => React.ReactNode
  /** Called when the active video plays through to its end. */
  onEnded?: () => void
}

export function VideoStage({ video, active, near, publishApi, renderOverlay, onEnded }: Props) {
  const ref = useRef<HTMLVideoElement>(null)
  const preload = useSettings((s) => s.preload)
  const { url, missing } = useMediaUrl(video, near)
  const api = useVideoPlayback(ref, {
    video,
    active,
    src: url,
    // Only the active slide can advance the feed.
    onEnded: active ? onEnded : undefined,
  })

  // After every render, not during it: writing a ref mid-render is impure and
  // can be discarded by a re-entrant render.
  useEffect(() => {
    if (!active) return
    publishApi?.(api)
    return () => publishApi?.(null)
  })

  return (
    <section
      className="relative flex h-full w-full snap-start items-center justify-center overflow-hidden bg-black"
      aria-label={video.title}
      aria-current={active ? 'true' : undefined}
    >
      {/* Blurred fill so portrait and landscape clips both sit on a considered ground. */}
      {video.thumbnail && (
        <img
          src={video.thumbnail}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl"
        />
      )}

      {/*
        On wide screens the slide is a centred portrait column rather than a
        stretched-out video; the blurred fill above covers the remaining width.
      */}
      <div className="relative z-10 flex h-full w-full max-w-[min(100%,calc(100vh*9/16))] items-center justify-center">
      {near && url && (
        <video
          ref={ref}
          src={url}
          poster={video.thumbnail}
          playsInline
          // Only the active slide is worth fetching aggressively.
          preload={active ? 'auto' : preload}
          disablePictureInPicture={false}
          className="relative z-10 max-h-full max-w-full object-contain"
          onClick={api.togglePlay}
          tabIndex={-1}
        />
      )}

      {near && !url && !missing && (
        <div className="relative z-10 flex flex-col items-center gap-3 text-white/60">
          <span className="size-8 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
          <span className="sr-only">Loading video</span>
        </div>
      )}

      {(missing || api.failed) && (
        <div className="relative z-10 mx-8 max-w-sm rounded-2xl bg-black/70 p-6 text-center text-white/85 backdrop-blur-md">
          <AlertTriangle className="mx-auto mb-3 size-6 text-[var(--c-accent)]" aria-hidden="true" />
          <p className="text-sm font-medium">This video can’t be played</p>
          <p className="mt-1.5 text-xs text-white/60">
            {missing
              ? 'The media file is missing from local storage. Re-add it from the library.'
              : 'Your browser can’t decode this file. Try converting it to MP4 (H.264) or WebM.'}
          </p>
        </div>
      )}

      {!near && video.thumbnail && (
        <img
          src={video.thumbnail}
          alt=""
          aria-hidden="true"
          className="relative z-10 max-h-full max-w-full object-contain"
        />
      )}

      {/* Tap-to-start affordance when the browser refuses autoplay. */}
      {active && api.blocked && (
        <button
          type="button"
          onClick={api.togglePlay}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/35"
          aria-label={`Play ${video.title}`}
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-md">
            <Play className="size-8 translate-x-0.5 fill-white text-white" aria-hidden="true" />
          </span>
        </button>
      )}

      {active && !api.playing && !api.blocked && !api.failed && url && (
        <span
          className={cn(
            'pointer-events-none absolute z-20 flex size-20 items-center justify-center rounded-full bg-black/40 backdrop-blur-md animate-fade',
          )}
          aria-hidden="true"
        >
          <Play className="size-8 translate-x-0.5 fill-white text-white" />
        </span>
      )}

        {active && renderOverlay?.(api)}
      </div>
    </section>
  )
}
