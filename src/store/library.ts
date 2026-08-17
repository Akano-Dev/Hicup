import { create } from 'zustand'
import { storage } from '@/services/storage/indexedDb'
import { isVideoFile, probeVideo } from '@/services/video/probe'
import {
  DEFAULT_CATEGORIES,
  type Collection,
  type HistoryEntry,
  type Video,
  type WatchSession,
} from '@/types'
import { titleFromFilename, uid } from '@/utils/format'
import { useQueue } from './queue'
import { getSettings } from './settings'

export interface ImportProgress {
  total: number
  done: number
  current: string
  failed: string[]
}

interface LibraryState {
  ready: boolean
  videos: Video[]
  collections: Collection[]
  history: HistoryEntry[]
  sessions: WatchSession[]
  categories: string[]
  importProgress: ImportProgress | null

  load: () => Promise<void>
  importFiles: (files: File[], category?: string) => Promise<Video[]>
  addRemoteVideos: (videos: Video[]) => Promise<void>
  updateVideo: (id: string, patch: Partial<Video>) => Promise<void>
  deleteVideo: (id: string) => Promise<void>
  deleteVideos: (ids: string[]) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>

  recordWatch: (
    videoId: string,
    data: { position: number; duration: number; secondsWatched: number },
  ) => Promise<void>
  deleteHistoryEntry: (id: string) => Promise<void>
  clearHistory: () => Promise<void>

  createCollection: (name: string, description?: string) => Promise<Collection>
  updateCollection: (id: string, patch: Partial<Collection>) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  addToCollection: (collectionId: string, videoIds: string[]) => Promise<void>
  removeFromCollection: (collectionId: string, videoId: string) => Promise<void>
  reorderCollection: (collectionId: string, videoIds: string[]) => Promise<void>

  addCategory: (name: string) => Promise<void>
  removeCategory: (name: string) => Promise<void>

  saveSession: (session: WatchSession) => Promise<void>
  resetAll: () => Promise<void>
  replaceState: (data: {
    videos?: Video[]
    collections?: Collection[]
    history?: HistoryEntry[]
    sessions?: WatchSession[]
  }) => Promise<void>
}

/** Consecutive plays of the same video inside this window fold into one entry. */
const HISTORY_MERGE_WINDOW = 6 * 3_600_000

function makeVideo(file: File, category: string): Video {
  return {
    id: uid('v_'),
    title: titleFromFilename(file.name),
    description: '',
    filename: file.name,
    mimeType: file.type || 'video/mp4',
    size: file.size,
    sourceKind: 'blob',
    duration: 0,
    category,
    tags: [],
    dateAdded: Date.now(),
    watchProgress: 0,
    completed: false,
    favorite: false,
    playCount: 0,
  }
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  ready: false,
  videos: [],
  collections: [],
  history: [],
  sessions: [],
  categories: [...DEFAULT_CATEGORIES],
  importProgress: null,

  async load() {
    await storage.init()
    const [videos, collections, history, sessions, categories] = await Promise.all([
      storage.listVideos(),
      storage.listCollections(),
      storage.listHistory(),
      storage.listSessions(),
      storage.getCategories(),
    ])
    set({
      ready: true,
      videos: videos.sort((a, b) => b.dateAdded - a.dateAdded),
      collections: collections.sort((a, b) => b.updatedAt - a.updatedAt),
      history: history.sort((a, b) => b.watchedAt - a.watchedAt),
      sessions,
      categories: categories?.length ? categories : [...DEFAULT_CATEGORIES],
    })
  },

  async importFiles(files, category = 'Other') {
    const accepted = files.filter(isVideoFile)
    const failed = files.filter((f) => !isVideoFile(f)).map((f) => f.name)
    if (!accepted.length) {
      if (failed.length) set({ importProgress: { total: 0, done: 0, current: '', failed } })
      return []
    }

    set({ importProgress: { total: accepted.length, done: 0, current: accepted[0].name, failed } })
    const created: Video[] = []

    for (const [index, file] of accepted.entries()) {
      set({
        importProgress: { total: accepted.length, done: index, current: file.name, failed },
      })
      try {
        const video = makeVideo(file, category)
        const probe = await probeVideo(file)
        video.duration = probe.duration
        video.thumbnail = probe.thumbnail
        await storage.putMedia(video.id, file)
        await storage.putVideo(video)
        created.push(video)
        set((state) => ({ videos: [video, ...state.videos] }))
      } catch (error) {
        console.error('Import failed', file.name, error)
        failed.push(file.name)
      }
    }

    set({
      importProgress: { total: accepted.length, done: accepted.length, current: '', failed },
    })
    // Leave the summary up briefly so the UI can show what failed.
    setTimeout(() => {
      if (get().importProgress?.done === accepted.length) set({ importProgress: null })
    }, failed.length ? 6000 : 1200)
    return created
  },

  async addRemoteVideos(videos) {
    await storage.putVideos(videos)
    set((state) => ({ videos: [...videos, ...state.videos] }))
  },

  async updateVideo(id, patch) {
    const current = get().videos.find((v) => v.id === id)
    if (!current) return
    const next = { ...current, ...patch }
    await storage.putVideo(next)
    set((state) => ({ videos: state.videos.map((v) => (v.id === id ? next : v)) }))
  },

  async deleteVideo(id) {
    await get().deleteVideos([id])
  },

  async deleteVideos(ids) {
    const set_ = new Set(ids)
    await Promise.all(ids.map((id) => storage.deleteVideo(id)))
    const collections = get().collections.filter((c) => c.videoIds.some((v) => set_.has(v)))
    await Promise.all(
      collections.map((c) => {
        const next = { ...c, videoIds: c.videoIds.filter((v) => !set_.has(v)) }
        return storage.putCollection(next)
      }),
    )
    const orphanHistory = get().history.filter((h) => set_.has(h.videoId))
    await Promise.all(orphanHistory.map((h) => storage.deleteHistory(h.id)))

    // The queue lives outside this store; drop deleted ids so its badge and
    // "play queue" don't count videos that no longer exist.
    const queue = useQueue.getState()
    if (queue.ids.some((id) => set_.has(id))) {
      queue.set(queue.ids.filter((id) => !set_.has(id)))
    }

    set((state) => ({
      videos: state.videos.filter((v) => !set_.has(v.id)),
      collections: state.collections.map((c) =>
        c.videoIds.some((v) => set_.has(v))
          ? { ...c, videoIds: c.videoIds.filter((v) => !set_.has(v)) }
          : c,
      ),
      history: state.history.filter((h) => !set_.has(h.videoId)),
    }))
  },

  async toggleFavorite(id) {
    const video = get().videos.find((v) => v.id === id)
    if (!video) return
    await get().updateVideo(id, { favorite: !video.favorite })
  },

  async recordWatch(videoId, { position, duration, secondsWatched }) {
    const state = get()
    const video = state.videos.find((v) => v.id === videoId)
    if (!video) return

    const threshold = getSettings().completionThreshold
    const progress = duration > 0 ? Math.min(1, position / duration) : 0
    const completed = video.completed || progress >= threshold
    const justCompleted = !video.completed && completed

    await get().updateVideo(videoId, {
      watchProgress: completed && progress >= threshold ? 0 : position,
      completed,
      lastWatched: Date.now(),
      playCount: video.playCount + (justCompleted ? 1 : 0),
    })

    const recent = state.history.find(
      (h) => h.videoId === videoId && Date.now() - h.watchedAt < HISTORY_MERGE_WINDOW,
    )
    const entry: HistoryEntry = recent
      ? {
          ...recent,
          watchedAt: Date.now(),
          secondsWatched: recent.secondsWatched + secondsWatched,
          progress: Math.max(recent.progress, progress),
          completed: recent.completed || completed,
        }
      : {
          id: uid('h_'),
          videoId,
          watchedAt: Date.now(),
          secondsWatched,
          progress,
          completed,
        }

    await storage.putHistory(entry)
    set((s) => ({
      history: [entry, ...s.history.filter((h) => h.id !== entry.id)].sort(
        (a, b) => b.watchedAt - a.watchedAt,
      ),
    }))
  },

  async deleteHistoryEntry(id) {
    await storage.deleteHistory(id)
    set((s) => ({ history: s.history.filter((h) => h.id !== id) }))
  },

  async clearHistory() {
    await storage.clearHistory()
    set({ history: [] })
  },

  async createCollection(name, description = '') {
    const collection: Collection = {
      id: uid('c_'),
      name,
      description,
      videoIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await storage.putCollection(collection)
    set((s) => ({ collections: [collection, ...s.collections] }))
    return collection
  },

  async updateCollection(id, patch) {
    const current = get().collections.find((c) => c.id === id)
    if (!current) return
    const next = { ...current, ...patch, updatedAt: Date.now() }
    await storage.putCollection(next)
    set((s) => ({ collections: s.collections.map((c) => (c.id === id ? next : c)) }))
  },

  async deleteCollection(id) {
    await storage.deleteCollection(id)
    set((s) => ({ collections: s.collections.filter((c) => c.id !== id) }))
  },

  async addToCollection(collectionId, videoIds) {
    const collection = get().collections.find((c) => c.id === collectionId)
    if (!collection) return
    const merged = [...collection.videoIds, ...videoIds.filter((id) => !collection.videoIds.includes(id))]
    await get().updateCollection(collectionId, { videoIds: merged })
  },

  async removeFromCollection(collectionId, videoId) {
    const collection = get().collections.find((c) => c.id === collectionId)
    if (!collection) return
    await get().updateCollection(collectionId, {
      videoIds: collection.videoIds.filter((id) => id !== videoId),
    })
  },

  async reorderCollection(collectionId, videoIds) {
    await get().updateCollection(collectionId, { videoIds })
  },

  async addCategory(name) {
    const trimmed = name.trim()
    if (!trimmed || get().categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return
    const next = [...get().categories, trimmed]
    await storage.putCategories(next)
    set({ categories: next })
  },

  async removeCategory(name) {
    const next = get().categories.filter((c) => c !== name)
    await storage.putCategories(next)
    set({ categories: next })
    const affected = get().videos.filter((v) => v.category === name)
    await Promise.all(affected.map((v) => get().updateVideo(v.id, { category: 'Other' })))
  },

  async saveSession(session) {
    await storage.putSession(session)
    set((s) => ({ sessions: [...s.sessions.filter((x) => x.id !== session.id), session] }))
  },

  async resetAll() {
    await storage.reset()
    set({
      videos: [],
      collections: [],
      history: [],
      sessions: [],
      categories: [...DEFAULT_CATEGORIES],
    })
  },

  async replaceState({ videos, collections, history, sessions }) {
    if (videos) {
      await storage.putVideos(videos)
      set((s) => {
        const byId = new Map(s.videos.map((v) => [v.id, v]))
        for (const v of videos) byId.set(v.id, { ...byId.get(v.id), ...v })
        return { videos: [...byId.values()].sort((a, b) => b.dateAdded - a.dateAdded) }
      })
    }
    if (collections) {
      await Promise.all(collections.map((c) => storage.putCollection(c)))
      set((s) => {
        const byId = new Map(s.collections.map((c) => [c.id, c]))
        for (const c of collections) byId.set(c.id, c)
        return { collections: [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt) }
      })
    }
    if (history) {
      await Promise.all(history.map((h) => storage.putHistory(h)))
      set((s) => {
        const byId = new Map(s.history.map((h) => [h.id, h]))
        for (const h of history) byId.set(h.id, h)
        return { history: [...byId.values()].sort((a, b) => b.watchedAt - a.watchedAt) }
      })
    }
    if (sessions) {
      await Promise.all(sessions.map((x) => storage.putSession(x)))
      set((s) => {
        const byId = new Map(s.sessions.map((x) => [x.id, x]))
        for (const x of sessions) byId.set(x.id, x)
        return { sessions: [...byId.values()] }
      })
    }
  },
}))
