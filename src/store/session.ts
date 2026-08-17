import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SessionSource, WatchSession } from '@/types'
import { uid } from '@/utils/format'
import { useLibrary } from './library'

interface SessionState {
  active: WatchSession | null
  /** Set when a timed session runs out; drives the completion screen. */
  finished: WatchSession | null

  start: (config: {
    plannedSeconds: number
    source: SessionSource
    shuffle: boolean
    videoIds: string[]
  }) => WatchSession
  /** Accrue watched wall-clock time; returns true when the planned time is up. */
  tick: (seconds: number) => boolean
  markWatched: (videoId: string) => void
  end: (options?: { complete?: boolean }) => void
  dismiss: () => void
  clearFinished: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      active: null,
      finished: null,

      start({ plannedSeconds, source, shuffle, videoIds }) {
        const session: WatchSession = {
          id: uid('s_'),
          startedAt: Date.now(),
          plannedSeconds,
          elapsedSeconds: 0,
          source,
          shuffle,
          videoIds,
          videosWatched: [],
        }
        set({ active: session, finished: null })
        return session
      },

      tick(seconds) {
        const active = get().active
        if (!active) return false
        const elapsed = active.elapsedSeconds + seconds
        const done = active.plannedSeconds > 0 && elapsed >= active.plannedSeconds
        set({ active: { ...active, elapsedSeconds: elapsed } })
        if (done) get().end({ complete: true })
        return done
      },

      markWatched(videoId) {
        const active = get().active
        if (!active || active.videosWatched.includes(videoId)) return
        set({ active: { ...active, videosWatched: [...active.videosWatched, videoId] } })
      },

      end({ complete = false } = {}) {
        const active = get().active
        if (!active) return
        const finished: WatchSession = { ...active, endedAt: Date.now() }
        void useLibrary.getState().saveSession(finished)
        set({ active: null, finished: complete ? finished : null })
      },

      dismiss() {
        get().end()
        set({ finished: null })
      },

      clearFinished: () => set({ finished: null }),
    }),
    {
      name: 'hicup.session',
      version: 1,
      partialize: (state) => ({ active: state.active }),
    },
  ),
)
