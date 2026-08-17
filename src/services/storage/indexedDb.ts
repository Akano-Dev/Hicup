import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Collection, HistoryEntry, Settings, Video, WatchSession } from '@/types'
import type { StorageAdapter } from './types'

const DB_NAME = 'hicup'
const DB_VERSION = 1

interface HicupDB extends DBSchema {
  videos: {
    key: string
    value: Video
    indexes: { dateAdded: number; category: string }
  }
  media: { key: string; value: Blob }
  collections: { key: string; value: Collection }
  history: {
    key: string
    value: HistoryEntry
    indexes: { watchedAt: number; videoId: string }
  }
  sessions: { key: string; value: WatchSession }
  meta: { key: string; value: unknown }
}

/** Object URLs are expensive to leak; keep a small LRU and revoke evictions. */
const MAX_CACHED_URLS = 10

export class IndexedDbAdapter implements StorageAdapter {
  #db: IDBPDatabase<HicupDB> | null = null
  #urls = new Map<string, string>()

  async init(): Promise<void> {
    if (this.#db) return
    this.#db = await openDB<HicupDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const videos = db.createObjectStore('videos', { keyPath: 'id' })
        videos.createIndex('dateAdded', 'dateAdded')
        videos.createIndex('category', 'category')
        db.createObjectStore('media')
        db.createObjectStore('collections', { keyPath: 'id' })
        const history = db.createObjectStore('history', { keyPath: 'id' })
        history.createIndex('watchedAt', 'watchedAt')
        history.createIndex('videoId', 'videoId')
        db.createObjectStore('sessions', { keyPath: 'id' })
        db.createObjectStore('meta')
      },
    })
  }

  get #database(): IDBPDatabase<HicupDB> {
    if (!this.#db) throw new Error('Storage used before init()')
    return this.#db
  }

  listVideos() {
    return this.#database.getAll('videos')
  }
  getVideo(id: string) {
    return this.#database.get('videos', id)
  }
  async putVideo(video: Video) {
    await this.#database.put('videos', video)
  }
  async putVideos(videos: Video[]) {
    const tx = this.#database.transaction('videos', 'readwrite')
    await Promise.all([...videos.map((v) => tx.store.put(v)), tx.done])
  }
  async deleteVideo(id: string) {
    this.releaseMediaUrl(id)
    const tx = this.#database.transaction(['videos', 'media'], 'readwrite')
    await Promise.all([
      tx.objectStore('videos').delete(id),
      tx.objectStore('media').delete(id),
      tx.done,
    ])
  }

  async putMedia(id: string, blob: Blob) {
    await this.#database.put('media', blob, id)
  }

  async resolveMediaUrl(video: Video): Promise<string | undefined> {
    if (video.sourceKind === 'url') return video.sourceUrl
    const cached = this.#urls.get(video.id)
    if (cached) {
      // Refresh LRU position.
      this.#urls.delete(video.id)
      this.#urls.set(video.id, cached)
      return cached
    }
    const blob = await this.#database.get('media', video.id)
    if (!blob) return undefined
    const url = URL.createObjectURL(blob)
    this.#urls.set(video.id, url)
    if (this.#urls.size > MAX_CACHED_URLS) {
      const oldest = this.#urls.keys().next().value
      if (oldest !== undefined && oldest !== video.id) this.releaseMediaUrl(oldest)
    }
    return url
  }

  releaseMediaUrl(id: string) {
    const url = this.#urls.get(id)
    if (!url) return
    URL.revokeObjectURL(url)
    this.#urls.delete(id)
  }

  async estimateUsage() {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  }

  listCollections() {
    return this.#database.getAll('collections')
  }
  async putCollection(collection: Collection) {
    await this.#database.put('collections', collection)
  }
  async deleteCollection(id: string) {
    await this.#database.delete('collections', id)
  }

  listHistory() {
    return this.#database.getAll('history')
  }
  async putHistory(entry: HistoryEntry) {
    await this.#database.put('history', entry)
  }
  async deleteHistory(id: string) {
    await this.#database.delete('history', id)
  }
  async clearHistory() {
    await this.#database.clear('history')
  }

  listSessions() {
    return this.#database.getAll('sessions')
  }
  async putSession(session: WatchSession) {
    await this.#database.put('sessions', session)
  }

  async getCategories() {
    return (await this.#database.get('meta', 'categories')) as string[] | undefined
  }
  async putCategories(categories: string[]) {
    await this.#database.put('meta', categories, 'categories')
  }

  async getSettings() {
    return (await this.#database.get('meta', 'settings')) as Partial<Settings> | undefined
  }
  async putSettings(settings: Settings) {
    await this.#database.put('meta', settings, 'settings')
  }

  async reset() {
    for (const id of [...this.#urls.keys()]) this.releaseMediaUrl(id)
    const names = ['videos', 'media', 'collections', 'history', 'sessions', 'meta'] as const
    const tx = this.#database.transaction(names, 'readwrite')
    await Promise.all([...names.map((n) => tx.objectStore(n).clear()), tx.done])
  }
}

export const storage: StorageAdapter = new IndexedDbAdapter()
