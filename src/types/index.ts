/** Core domain models. Kept intentionally flat — this is a single-user local app. */

export type VideoSourceKind = 'blob' | 'url'

export interface Video {
  id: string
  title: string
  description: string
  /** Original filename, retained for search and display. */
  filename: string
  mimeType: string
  /** Bytes; 0 for url-backed entries. */
  size: number
  sourceKind: VideoSourceKind
  /** Present when sourceKind === 'url' (demo content, or a remote/served file). */
  sourceUrl?: string
  /** Data URL of a generated poster frame. */
  thumbnail?: string
  /** Seconds. */
  duration: number
  category: string
  tags: string[]
  dateAdded: number
  lastWatched?: number
  /** Seconds into the video where playback stopped. */
  watchProgress: number
  completed: boolean
  favorite: boolean
  /** Times watched to completion-threshold. */
  playCount: number
  /** True for bundled sample content so it can be cleanly removed. */
  demo?: boolean
}

export interface Collection {
  id: string
  name: string
  description: string
  /** Ordered video ids. */
  videoIds: string[]
  createdAt: number
  updatedAt: number
}

export interface HistoryEntry {
  id: string
  videoId: string
  watchedAt: number
  /** Seconds of this video actually watched in the session. */
  secondsWatched: number
  /** 0–1 furthest position reached. */
  progress: number
  completed: boolean
}

export type SessionSourceKind = 'all' | 'category' | 'collection' | 'favorites' | 'queue' | 'search'

export interface SessionSource {
  kind: SessionSourceKind
  /** Category name or collection id, depending on kind. */
  value?: string
  label: string
}

export interface WatchSession {
  id: string
  startedAt: number
  endedAt?: number
  /** Planned length in seconds; 0 means untimed. */
  plannedSeconds: number
  /** Wall-clock seconds elapsed while the feed was visible. */
  elapsedSeconds: number
  source: SessionSource
  shuffle: boolean
  videoIds: string[]
  videosWatched: string[]
}

export type ThemeMode = 'dark' | 'light' | 'system'
export type AccentName = 'amber' | 'iris' | 'mint' | 'rose' | 'ice'
export type PreloadMode = 'none' | 'metadata' | 'auto'
export type LibraryView = 'grid' | 'list'

export interface Settings {
  autoplay: boolean
  resumePlayback: boolean
  volume: number
  muted: boolean
  loop: boolean
  /** Advance to the next video when the current one finishes. Overrides loop. */
  autoAdvance: boolean
  preload: PreloadMode
  theme: ThemeMode
  accent: AccentName
  reducedMotion: boolean
  defaultSessionMinutes: number
  showSessionTimer: boolean
  showCompletionScreen: boolean
  libraryView: LibraryView
  /** Fraction of duration after which a video counts as completed. */
  completionThreshold: number
}

export interface LibraryExport {
  version: number
  exportedAt: number
  videos: Array<Omit<Video, 'thumbnail'> & { thumbnail?: string }>
  collections: Collection[]
  watchHistory: HistoryEntry[]
  sessions: WatchSession[]
  settings: Settings
}

export const DEFAULT_CATEGORIES = [
  'Gaming',
  'Programming',
  'Movies',
  'Documentaries',
  'Music',
  'Learning',
  'Fitness',
  'Inspiration',
  'Memes',
  'Personal',
  'Other',
] as const

export const DEFAULT_SETTINGS: Settings = {
  autoplay: true,
  resumePlayback: true,
  volume: 1,
  muted: true,
  loop: true,
  autoAdvance: false,
  preload: 'metadata',
  theme: 'dark',
  accent: 'amber',
  reducedMotion: false,
  defaultSessionMinutes: 30,
  showSessionTimer: true,
  showCompletionScreen: true,
  libraryView: 'grid',
  completionThreshold: 0.9,
}
