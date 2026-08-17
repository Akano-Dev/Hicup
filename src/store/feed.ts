import { create } from 'zustand'
import type { SessionSource } from '@/types'

interface FeedState {
  /** Ordered video ids currently loaded into the vertical feed. */
  playlist: string[]
  index: number
  source: SessionSource | null
  shuffle: boolean

  setPlaylist: (config: {
    playlist: string[]
    source: SessionSource
    shuffle?: boolean
    startId?: string
  }) => void
  setIndex: (index: number) => void
  /** Drop ids that no longer exist (e.g. deleted mid-feed). */
  prune: (existing: Set<string>) => void
  clear: () => void
}

export const useFeed = create<FeedState>()((set, get) => ({
  playlist: [],
  index: 0,
  source: null,
  shuffle: false,

  setPlaylist({ playlist, source, shuffle = false, startId }) {
    const startIndex = startId ? Math.max(0, playlist.indexOf(startId)) : 0
    set({ playlist, source, shuffle, index: startIndex })
  },

  setIndex(index) {
    const { playlist, index: current } = get()
    const next = Math.max(0, Math.min(index, playlist.length - 1))
    if (next !== current) set({ index: next })
  },

  prune(existing) {
    const { playlist, index } = get()
    const currentId = playlist[index]
    const next = playlist.filter((id) => existing.has(id))
    if (next.length === playlist.length) return
    const nextIndex = currentId ? next.indexOf(currentId) : -1
    set({ playlist: next, index: nextIndex >= 0 ? nextIndex : Math.min(index, next.length - 1) })
  },

  clear: () => set({ playlist: [], index: 0, source: null, shuffle: false }),
}))
