import { useCallback, useEffect, useRef, useState } from 'react'
import { hasResumableProgress } from '@/services/library'
import { useLibrary } from '@/store/library'
import { useSettings } from '@/store/settings'
import type { Video } from '@/types'

/** Progress is flushed to storage at most this often while playing. */
const SAVE_INTERVAL_MS = 5_000
/** Never resume within this many seconds of the end — it would just re-trigger. */
const RESUME_TAIL_GUARD = 1

let userHasInteracted = false
if (typeof window !== 'undefined') {
  const mark = () => {
    userHasInteracted = true
  }
  window.addEventListener('pointerdown', mark, { once: true, capture: true })
  window.addEventListener('keydown', mark, { once: true, capture: true })
}

export interface PlaybackApi {
  playing: boolean
  buffering: boolean
  currentTime: number
  duration: number
  /** Autoplay was blocked outright — the user must tap to start. */
  blocked: boolean
  failed: boolean
  /** This file carries embedded subtitle/caption tracks. */
  hasCaptions: boolean
  captionsOn: boolean
  togglePlay: () => void
  toggleCaptions: () => void
  seek: (seconds: number) => void
  seekBy: (delta: number) => void
  restart: () => void
}

interface Options {
  video: Video | undefined
  active: boolean
  src: string | undefined
  /** Fired when the video plays through to its end. */
  onEnded?: () => void
}

export function useVideoPlayback(
  ref: React.RefObject<HTMLVideoElement | null>,
  { video, active, src, onEnded }: Options,
): PlaybackApi {
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(video?.duration ?? 0)
  const [blocked, setBlocked] = useState(false)
  const [failed, setFailed] = useState(false)
  const [hasCaptions, setHasCaptions] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(false)

  const watchedRef = useRef(0)
  const lastTimeRef = useRef(0)
  const lastSaveRef = useRef(0)
  const didResumeRef = useRef(false)

  /**
   * The latest video, readable from effects without making them depend on its
   * object identity — the store hands back a new object on every progress save,
   * and re-running the activation effect on that would pause/replay the element
   * every few seconds.
   */
  const videoRef = useRef(video)
  videoRef.current = video
  // Held in a ref so the element-event effect doesn't re-subscribe per render.
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const lastFlushedRef = useRef(-1)

  /** Persist position + watched seconds. No-op when nothing meaningful changed. */
  const flush = useCallback(() => {
    const element = ref.current
    const current = videoRef.current
    if (!current || !element) return
    const watched = watchedRef.current
    const position = element.currentTime
    if (watched < 1 && Math.abs(position - lastFlushedRef.current) < 1) return
    watchedRef.current = 0
    lastFlushedRef.current = position
    // Read the action off the store so this callback stays referentially stable.
    void useLibrary.getState().recordWatch(current.id, {
      position,
      duration: element.duration || current.duration,
      secondsWatched: watched,
    })
  }, [ref])

  // Reset per-video bookkeeping when the slide changes identity.
  useEffect(() => {
    didResumeRef.current = false
    watchedRef.current = 0
    lastTimeRef.current = 0
    lastFlushedRef.current = -1
    setCurrentTime(0)
    setBlocked(false)
    setFailed(false)
    setHasCaptions(false)
    setCaptionsOn(false)
  }, [video?.id])

  // Surface embedded caption tracks when the file carries them.
  useEffect(() => {
    const element = ref.current
    if (!element || !src) return
    const sync = () => setHasCaptions(element.textTracks.length > 0)
    sync()
    element.textTracks.addEventListener?.('addtrack', sync)
    return () => element.textTracks.removeEventListener?.('addtrack', sync)
  }, [ref, src])

  const toggleCaptions = useCallback(() => {
    const element = ref.current
    if (!element) return
    const next = !captionsOn
    for (const track of element.textTracks) {
      if (track.kind === 'captions' || track.kind === 'subtitles') {
        track.mode = next ? 'showing' : 'disabled'
      }
    }
    setCaptionsOn(next)
  }, [ref, captionsOn])

  // Keep element volume in sync with settings without re-running playback logic.
  useEffect(() => {
    const apply = (muted: boolean, volume: number) => {
      const element = ref.current
      if (!element) return
      element.muted = muted
      element.volume = volume
    }
    const state = useSettings.getState()
    apply(state.muted, state.volume)
    return useSettings.subscribe((s) => apply(s.muted, s.volume))
  }, [ref, src])

  // Auto-advance needs the element to actually finish, so it overrides looping.
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const shouldLoop = (s: { loop: boolean; autoAdvance: boolean }) => s.loop && !s.autoAdvance
    element.loop = shouldLoop(useSettings.getState())
    return useSettings.subscribe((s) => {
      if (ref.current) ref.current.loop = shouldLoop(s)
    })
  }, [ref, src])

  const attemptPlay = useCallback(async () => {
    const element = ref.current
    if (!element) return
    try {
      await element.play()
      setBlocked(false)
    } catch {
      // Browsers block unmuted autoplay before a gesture; fall back to muted
      // rather than fighting the policy.
      if (!element.muted) {
        element.muted = true
        useSettings.getState().set('muted', true)
        try {
          await element.play()
          setBlocked(false)
          return
        } catch {
          /* fall through */
        }
      }
      setBlocked(true)
    }
  }, [ref])

  // Activation / deactivation.
  useEffect(() => {
    const element = ref.current
    if (!element || !src) return

    if (!active) {
      element.pause()
      flush()
      return
    }

    const settings = useSettings.getState()
    const current = videoRef.current
    // Same rule the Continue Watching shelf uses, so the two never disagree.
    const resumeTo =
      settings.resumePlayback && current && hasResumableProgress(current) ? current.watchProgress : 0

    const start = () => {
      if (!didResumeRef.current) {
        didResumeRef.current = true
        if (
          resumeTo > 0 &&
          Number.isFinite(element.duration) &&
          resumeTo < element.duration - RESUME_TAIL_GUARD
        ) {
          element.currentTime = resumeTo
        }
      }
      if (settings.autoplay || userHasInteracted) void attemptPlay()
    }

    if (element.readyState >= 1) start()
    else element.addEventListener('loadedmetadata', start, { once: true })

    return () => {
      element.removeEventListener('loadedmetadata', start)
      element.pause()
      flush()
    }
    // Deliberately keyed on identity-stable values only. Depending on the whole
    // `video` object would tear playback down on every progress save.
  }, [ref, src, active, video?.id, attemptPlay, flush])

  // Element events.
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const onPlay = () => {
      setPlaying(true)
      setBlocked(false)
      lastTimeRef.current = element.currentTime
    }
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => {
      const time = element.currentTime
      setCurrentTime(time)
      const delta = time - lastTimeRef.current
      // Only count forward, real-time playback — seeks and loops don't inflate totals.
      if (delta > 0 && delta < 2) watchedRef.current += delta
      lastTimeRef.current = time
      if (Date.now() - lastSaveRef.current > SAVE_INTERVAL_MS) {
        lastSaveRef.current = Date.now()
        flush()
      }
    }
    const onLoaded = () => setDuration(element.duration || 0)
    const onWaiting = () => setBuffering(true)
    const onPlaying = () => setBuffering(false)
    const onError = () => {
      setFailed(true)
      setPlaying(false)
    }
    const handleEnded = () => {
      setPlaying(false)
      flush()
      onEndedRef.current?.()
    }

    element.addEventListener('play', onPlay)
    element.addEventListener('pause', onPause)
    element.addEventListener('timeupdate', onTimeUpdate)
    element.addEventListener('loadedmetadata', onLoaded)
    element.addEventListener('durationchange', onLoaded)
    element.addEventListener('waiting', onWaiting)
    element.addEventListener('playing', onPlaying)
    element.addEventListener('canplay', onPlaying)
    element.addEventListener('error', onError)
    element.addEventListener('ended', handleEnded)
    return () => {
      element.removeEventListener('play', onPlay)
      element.removeEventListener('pause', onPause)
      element.removeEventListener('timeupdate', onTimeUpdate)
      element.removeEventListener('loadedmetadata', onLoaded)
      element.removeEventListener('durationchange', onLoaded)
      element.removeEventListener('waiting', onWaiting)
      element.removeEventListener('playing', onPlaying)
      element.removeEventListener('canplay', onPlaying)
      element.removeEventListener('error', onError)
      element.removeEventListener('ended', handleEnded)
    }
  }, [ref, src, flush])

  // Pause when the tab is hidden; resume only if we were playing.
  useEffect(() => {
    if (!active) return
    const onVisibility = () => {
      const element = ref.current
      if (!element) return
      if (document.hidden) {
        if (!element.paused) {
          element.dataset.resumeOnShow = '1'
          element.pause()
        }
      } else if (element.dataset.resumeOnShow) {
        delete element.dataset.resumeOnShow
        void element.play().catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [ref, active])

  const togglePlay = useCallback(() => {
    const element = ref.current
    if (!element) return
    if (element.paused) void attemptPlay()
    else element.pause()
  }, [ref, attemptPlay])

  const seek = useCallback(
    (seconds: number) => {
      const element = ref.current
      if (!element || !Number.isFinite(element.duration)) return
      element.currentTime = Math.max(0, Math.min(seconds, element.duration))
      lastTimeRef.current = element.currentTime
      setCurrentTime(element.currentTime)
    },
    [ref],
  )

  const seekBy = useCallback(
    (delta: number) => seek((ref.current?.currentTime ?? 0) + delta),
    [ref, seek],
  )

  const restart = useCallback(() => {
    seek(0)
    void attemptPlay()
  }, [seek, attemptPlay])

  return {
    playing,
    buffering,
    currentTime,
    duration,
    blocked,
    failed,
    hasCaptions,
    captionsOn,
    togglePlay,
    toggleCaptions,
    seek,
    seekBy,
    restart,
  }
}
