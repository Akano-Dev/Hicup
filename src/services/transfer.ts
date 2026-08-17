import type { Collection, HistoryEntry, LibraryExport, Settings, Video, WatchSession } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

const EXPORT_VERSION = 1

export function buildExport(data: {
  videos: Video[]
  collections: Collection[]
  history: HistoryEntry[]
  sessions: WatchSession[]
  settings: Settings
  includeThumbnails: boolean
}): LibraryExport {
  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    // Media bytes stay put — this file describes the library, it isn't a backup of it.
    videos: data.videos.map((video) =>
      data.includeThumbnails ? video : { ...video, thumbnail: undefined },
    ),
    collections: data.collections,
    watchHistory: data.history,
    sessions: data.sessions,
    settings: data.settings,
  }
}

export function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ParsedImport {
  videos: Video[]
  collections: Collection[]
  history: HistoryEntry[]
  sessions: WatchSession[]
  settings: Partial<Settings>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Imported metadata is merged into existing entries by id. Videos whose media
 * is missing locally still import — they show a clear "file missing" state
 * rather than silently disappearing.
 */
export function parseImport(raw: string): ParsedImport {
  const data: unknown = JSON.parse(raw)
  if (!isRecord(data)) throw new Error('That file is not a Hicup export.')

  const videos = Array.isArray(data.videos) ? (data.videos as unknown[]) : []
  const parsedVideos = videos.filter(isRecord).map((video) => ({
    id: String(video.id ?? ''),
    title: String(video.title ?? 'Untitled'),
    description: String(video.description ?? ''),
    filename: String(video.filename ?? ''),
    mimeType: String(video.mimeType ?? 'video/mp4'),
    size: Number(video.size ?? 0),
    sourceKind: video.sourceKind === 'url' ? 'url' : 'blob',
    sourceUrl: typeof video.sourceUrl === 'string' ? video.sourceUrl : undefined,
    thumbnail: typeof video.thumbnail === 'string' ? video.thumbnail : undefined,
    duration: Number(video.duration ?? 0),
    category: String(video.category ?? 'Other'),
    tags: Array.isArray(video.tags) ? video.tags.map(String) : [],
    dateAdded: Number(video.dateAdded ?? Date.now()),
    lastWatched: video.lastWatched ? Number(video.lastWatched) : undefined,
    watchProgress: Number(video.watchProgress ?? 0),
    completed: Boolean(video.completed),
    favorite: Boolean(video.favorite),
    playCount: Number(video.playCount ?? 0),
    demo: Boolean(video.demo),
  })) as Video[]

  if (!parsedVideos.length && !Array.isArray(data.collections)) {
    throw new Error('No library data found in that file.')
  }

  const settings = isRecord(data.settings)
    ? (Object.fromEntries(
        Object.entries(data.settings).filter(([key]) => key in DEFAULT_SETTINGS),
      ) as Partial<Settings>)
    : {}

  return {
    videos: parsedVideos.filter((v) => v.id),
    collections: Array.isArray(data.collections) ? (data.collections as Collection[]) : [],
    history: Array.isArray(data.watchHistory) ? (data.watchHistory as HistoryEntry[]) : [],
    sessions: Array.isArray(data.sessions) ? (data.sessions as WatchSession[]) : [],
    settings,
  }
}
