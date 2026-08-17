import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Keyboard, Shuffle, X } from 'lucide-react'
import { FeedOverlay } from '@/components/feed/FeedOverlay'
import { MoreSheet } from '@/components/feed/MoreSheet'
import { SessionComplete } from '@/components/feed/SessionComplete'
import { SessionTimer } from '@/components/feed/SessionTimer'
import { ShortcutsPanel } from '@/components/feed/ShortcutsPanel'
import { VideoStage } from '@/components/feed/VideoStage'
import { IconButton } from '@/components/ui/Button'
import type { PlaybackApi } from '@/hooks/useVideoPlayback'
import { shuffled } from '@/services/library'
import { useFeed } from '@/store/feed'
import { useLibrary } from '@/store/library'
import { useQueue } from '@/store/queue'
import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'
import { prefersReducedMotion } from '@/utils/motion'

/** Slides mounted around the active index. Everything else stays a placeholder. */
const WINDOW = 1
const WHEEL_LOCK_MS = 420

export function FeedPage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<PlaybackApi | null>(null)
  const wheelLockRef = useRef(0)

  const playlist = useFeed((s) => s.playlist)
  const index = useFeed((s) => s.index)
  const source = useFeed((s) => s.source)
  const shuffle = useFeed((s) => s.shuffle)
  const setIndex = useFeed((s) => s.setIndex)
  const setPlaylist = useFeed((s) => s.setPlaylist)
  const prune = useFeed((s) => s.prune)

  const videos = useLibrary((s) => s.videos)
  const toggleFavorite = useLibrary((s) => s.toggleFavorite)
  const queueIds = useQueue((s) => s.ids)
  const addToQueue = useQueue((s) => s.add)
  const removeFromQueue = useQueue((s) => s.remove)
  const muted = useSettings((s) => s.muted)
  const setSetting = useSettings((s) => s.set)
  const showTimer = useSettings((s) => s.showSessionTimer)
  const showCompletion = useSettings((s) => s.showCompletionScreen)

  const activeSession = useSession((s) => s.active)
  const finishedSession = useSession((s) => s.finished)
  const tick = useSession((s) => s.tick)
  const markWatched = useSession((s) => s.markWatched)
  const endSession = useSession((s) => s.end)
  const clearFinished = useSession((s) => s.clearFinished)

  const [fullscreen, setFullscreen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showMore, setShowMore] = useState(false)

  const byId = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos])
  const items = useMemo(
    () => playlist.map((id) => byId.get(id)).filter((v) => v !== undefined),
    [playlist, byId],
  )
  const current = items[index]

  // Drop ids for videos deleted while the feed is open.
  useEffect(() => {
    if (playlist.some((id) => !byId.has(id))) prune(new Set(byId.keys()))
  }, [playlist, byId, prune])

  useEffect(() => {
    if (playlist.length === 0) navigate('/', { replace: true })
  }, [playlist.length, navigate])

  // Ref only: keyboard shortcuts read this at event time, so no render needed.
  const setApi = useCallback((api: PlaybackApi | null) => {
    apiRef.current = api
  }, [])

  const goTo = useCallback(
    (target: number, smooth = true) => {
      const container = containerRef.current
      if (!container) return
      const clamped = Math.max(0, Math.min(target, playlist.length - 1))
      setIndex(clamped)
      container.scrollTo({
        top: clamped * container.clientHeight,
        behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
      })
    },
    [playlist.length, setIndex],
  )

  // Restore scroll position when the feed mounts at a non-zero index.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.scrollTop = index * container.clientHeight
    // Intentionally mount-only: later index changes come from scrolling itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the active slide aligned when the viewport changes size — rotating a
  // phone or opening the keyboard otherwise leaves the feed mid-slide.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const realign = () => {
      container.scrollTo({ top: useFeed.getState().index * container.clientHeight, behavior: 'auto' })
    }
    const observer = new ResizeObserver(realign)
    observer.observe(container)
    window.addEventListener('orientationchange', realign)
    return () => {
      observer.disconnect()
      window.removeEventListener('orientationchange', realign)
    }
  }, [])

  // Active-slide detection.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const slideIndex = Number((entry.target as HTMLElement).dataset.index)
          if (Number.isInteger(slideIndex)) setIndex(slideIndex)
        }
      },
      { root: container, threshold: 0.6 },
    )
    for (const slide of container.querySelectorAll('[data-slide]')) observer.observe(slide)
    return () => observer.disconnect()
  }, [playlist.length, setIndex])

  // Wheel: one slide per gesture, rather than snap fighting momentum scrolling.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 8) return
      event.preventDefault()
      const now = Date.now()
      if (now < wheelLockRef.current) return
      wheelLockRef.current = now + WHEEL_LOCK_MS
      goTo(useFeed.getState().index + (event.deltaY > 0 ? 1 : -1))
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [goTo])

  /** Auto-scroll: move on when the current video finishes, stopping at the end. */
  const handleEnded = useCallback(() => {
    if (!useSettings.getState().autoAdvance) return
    const current = useFeed.getState().index
    if (current < playlist.length - 1) goTo(current + 1)
  }, [goTo, playlist.length])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void container.requestFullscreen?.().catch(() => undefined)
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    // Going back only works if we arrived from somewhere; opening /feed directly
    // (or after a replace) would otherwise navigate out of the app entirely.
    const entry = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (entry > 0) navigate(-1)
    else navigate('/', { replace: true })
  }, [navigate])

  const toggleQueue = useCallback(() => {
    if (!current) return
    if (queueIds.includes(current.id)) removeFromQueue(current.id)
    else addToQueue(current.id)
  }, [current, queueIds, addToQueue, removeFromQueue])

  const shuffleRemaining = useCallback(() => {
    if (!source || playlist.length < 3) return
    const played = playlist.slice(0, index + 1)
    setPlaylist({
      playlist: [...played, ...shuffled(playlist.slice(index + 1))],
      source,
      shuffle: true,
      startId: playlist[index],
    })
  }, [source, playlist, index, setPlaylist])

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [role="dialog"]')) return
      // A dialog can be open while focus sits on the body — shortcuts must not
      // reach the video behind it.
      if (document.querySelector('[role="dialog"]')) return
      const api = apiRef.current
      switch (event.key) {
        case ' ':
          event.preventDefault()
          api?.togglePlay()
          break
        case 'ArrowDown':
          event.preventDefault()
          goTo(useFeed.getState().index + 1)
          break
        case 'ArrowUp':
          event.preventDefault()
          goTo(useFeed.getState().index - 1)
          break
        case 'ArrowRight':
          event.preventDefault()
          api?.seekBy(5)
          break
        case 'ArrowLeft':
          event.preventDefault()
          api?.seekBy(-5)
          break
        case 'm':
        case 'M':
          setSetting('muted', !useSettings.getState().muted)
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'l':
        case 'L':
          if (current) void toggleFavorite(current.id)
          break
        case 'q':
        case 'Q':
          toggleQueue()
          break
        case 's':
        case 'S':
          shuffleRemaining()
          break
        case '?':
          setShowShortcuts(true)
          break
        case 'Escape':
          if (!document.fullscreenElement) exit()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goTo, current, toggleFavorite, toggleQueue, toggleFullscreen, shuffleRemaining, setSetting, exit])

  // Session accounting: one tick per visible second.
  useEffect(() => {
    if (!activeSession) return
    const interval = setInterval(() => {
      if (document.hidden) return
      tick(1)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeSession, tick])

  useEffect(() => {
    if (activeSession && current) markWatched(current.id)
  }, [activeSession, current, markWatched])

  if (finishedSession && showCompletion) {
    return (
      <SessionComplete
        session={finishedSession}
        onEnd={() => {
          clearFinished()
          navigate('/', { replace: true })
        }}
        onAnother={() => {
          clearFinished()
          navigate('/?session=1', { replace: true })
        }}
      />
    )
  }

  if (!current) return null

  const remaining = activeSession
    ? Math.max(0, activeSession.plannedSeconds - activeSession.elapsedSeconds)
    : 0

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      {/* The feed swaps content without navigating, so announce the change. */}
      <p aria-live="polite" className="sr-only">
        {`${current.title}, ${index + 1} of ${playlist.length}`}
      </p>

      <div
        ref={containerRef}
        className="scrollbar-none snap-feed h-full w-full overflow-y-auto"
        tabIndex={-1}
      >
        {playlist.map((id, i) => {
          const video = byId.get(id)
          const isActive = i === index
          const near = Math.abs(i - index) <= WINDOW
          return (
            <div key={id} data-slide data-index={i} className="h-full w-full">
              {video && (
                <VideoStage
                  video={video}
                  active={isActive}
                  near={near}
                  publishApi={setApi}
                  onEnded={handleEnded}
                  renderOverlay={(api) => (
                    <FeedOverlay
                      video={video}
                      api={api}
                      muted={muted}
                      favorite={video.favorite}
                      queued={queueIds.includes(video.id)}
                      fullscreen={fullscreen}
                      position={{ index: i, total: playlist.length }}
                      onToggleMute={() => setSetting('muted', !muted)}
                      onToggleFavorite={() => void toggleFavorite(video.id)}
                      onToggleQueue={toggleQueue}
                      onToggleFullscreen={toggleFullscreen}
                      onMore={() => setShowMore(true)}
                    />
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 pad-safe-t">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/65 to-transparent" />
        <div className="relative flex items-center gap-2 px-3 py-3 sm:px-5">
          <IconButton label="Leave feed" onVideo size="sm" onClick={exit} className="pointer-events-auto">
            <X className="size-5" />
          </IconButton>

          <div className="pointer-events-none min-w-0 flex-1">
            {source && (
              <p className="truncate text-xs font-medium text-white/70">
                {source.label}
                {shuffle && ' · Shuffled'}
              </p>
            )}
          </div>

          {activeSession && showTimer && activeSession.plannedSeconds > 0 && (
            <div className="pointer-events-auto">
              <SessionTimer remaining={remaining} planned={activeSession.plannedSeconds} />
            </div>
          )}
          {activeSession && (
            <button
              type="button"
              onClick={() => {
                endSession()
                navigate('/', { replace: true })
              }}
              className="pointer-events-auto rounded-full bg-black/45 px-3 py-1.5 text-xs text-white/75 backdrop-blur-md transition hover:bg-black/65 hover:text-white"
            >
              End session
            </button>
          )}
          {/*
            Responsive display lives on a wrapper: putting `hidden` on the
            button itself collides with the base `inline-flex` utility.
          */}
          <span className="pointer-events-auto hidden sm:block">
            <IconButton label="Shuffle remaining videos" onVideo size="sm" onClick={shuffleRemaining}>
              <Shuffle className="size-4" />
            </IconButton>
          </span>
          <span className="pointer-events-auto hidden lg:block">
            <IconButton
              label="Keyboard shortcuts"
              onVideo
              size="sm"
              onClick={() => setShowShortcuts(true)}
            >
              <Keyboard className="size-4" />
            </IconButton>
          </span>
        </div>
      </div>

      {/* Desktop slide navigation */}
      <div className="absolute right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
        <IconButton
          label="Previous video"
          onVideo
          size="sm"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
        >
          <ChevronUp className="size-5" />
        </IconButton>
        <IconButton
          label="Next video"
          onVideo
          size="sm"
          disabled={index >= playlist.length - 1}
          onClick={() => goTo(index + 1)}
        >
          <ChevronDown className="size-5" />
        </IconButton>
      </div>

      <ShortcutsPanel open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      {current && (
        <MoreSheet
          open={showMore}
          onClose={() => setShowMore(false)}
          video={current}
          onRestart={() => apiRef.current?.restart()}
        />
      )}
    </div>
  )
}
