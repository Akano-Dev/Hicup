import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface QueueState {
  ids: string[]
  add: (id: string) => void
  addMany: (ids: string[]) => void
  remove: (id: string) => void
  move: (id: string, direction: -1 | 1) => void
  set: (ids: string[]) => void
  clear: () => void
  has: (id: string) => boolean
}

/** A deliberately temporary, ordered "tonight's watchlist". */
export const useQueue = create<QueueState>()(
  persist(
    (set, get) => ({
      ids: [],
      add: (id) => set((s) => (s.ids.includes(id) ? s : { ids: [...s.ids, id] })),
      addMany: (ids) =>
        set((s) => ({ ids: [...s.ids, ...ids.filter((id) => !s.ids.includes(id))] })),
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
      move: (id, direction) =>
        set((s) => {
          const index = s.ids.indexOf(id)
          const target = index + direction
          if (index < 0 || target < 0 || target >= s.ids.length) return s
          const ids = [...s.ids]
          ;[ids[index], ids[target]] = [ids[target], ids[index]]
          return { ids }
        }),
      set: (ids) => set({ ids }),
      clear: () => set({ ids: [] }),
      has: (id) => get().ids.includes(id),
    }),
    { name: 'hicup.queue', version: 1 },
  ),
)
