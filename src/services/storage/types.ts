import type { Collection, HistoryEntry, Settings, Video, WatchSession } from '@/types'

/**
 * The application talks to storage only through this interface, so the
 * IndexedDB implementation can later be swapped for a served media directory
 * or a sync backend without touching UI code.
 */
export interface StorageAdapter {
  init(): Promise<void>

  listVideos(): Promise<Video[]>
  getVideo(id: string): Promise<Video | undefined>
  putVideo(video: Video): Promise<void>
  putVideos(videos: Video[]): Promise<void>
  deleteVideo(id: string): Promise<void>

  /** Store the raw media bytes for a video. */
  putMedia(id: string, blob: Blob): Promise<void>
  /** Resolve a playable URL for a video, creating/caching an object URL if needed. */
  resolveMediaUrl(video: Video): Promise<string | undefined>
  /** Drop a cached object URL when it is no longer needed. */
  releaseMediaUrl(id: string): void
  /** Bytes currently used by stored media, when the environment can report it. */
  estimateUsage(): Promise<{ usage: number; quota: number } | null>

  listCollections(): Promise<Collection[]>
  putCollection(collection: Collection): Promise<void>
  deleteCollection(id: string): Promise<void>

  listHistory(): Promise<HistoryEntry[]>
  putHistory(entry: HistoryEntry): Promise<void>
  deleteHistory(id: string): Promise<void>
  clearHistory(): Promise<void>

  listSessions(): Promise<WatchSession[]>
  putSession(session: WatchSession): Promise<void>

  getCategories(): Promise<string[] | undefined>
  putCategories(categories: string[]): Promise<void>

  getSettings(): Promise<Partial<Settings> | undefined>
  putSettings(settings: Settings): Promise<void>

  /** Wipe everything. */
  reset(): Promise<void>
}
