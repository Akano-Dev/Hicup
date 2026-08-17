import type { HistoryEntry, Video } from '@/types'

export type SortKey = 'recent' | 'oldest' | 'title' | 'duration' | 'lastWatched' | 'category'
export type WatchFilter = 'all' | 'unwatched' | 'inProgress' | 'completed' | 'favorites'

export interface LibraryQuery {
  search?: string
  category?: string | null
  tag?: string | null
  watch?: WatchFilter
  sort?: SortKey
}

/** Weighted field match — title hits should outrank a stray filename hit. */
function score(video: Video, term: string): number {
  const title = video.title.toLowerCase()
  if (title === term) return 100
  let total = 0
  if (title.startsWith(term)) total += 60
  else if (title.includes(term)) total += 40
  if (video.tags.some((t) => t.toLowerCase() === term)) total += 35
  else if (video.tags.some((t) => t.toLowerCase().includes(term))) total += 20
  if (video.category.toLowerCase().includes(term)) total += 18
  if (video.description.toLowerCase().includes(term)) total += 12
  if (video.filename.toLowerCase().includes(term)) total += 8
  return total
}

export function searchVideos(videos: Video[], search: string): Video[] {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return videos
  return videos
    .map((video) => {
      // Every term must match something, so multi-word queries narrow rather than widen.
      let total = 0
      for (const term of terms) {
        const s = score(video, term)
        if (s === 0) return null
        total += s
      }
      return { video, total }
    })
    .filter((x): x is { video: Video; total: number } => x !== null)
    .sort((a, b) => b.total - a.total)
    .map((x) => x.video)
}

const sorters: Record<SortKey, (a: Video, b: Video) => number> = {
  recent: (a, b) => b.dateAdded - a.dateAdded,
  oldest: (a, b) => a.dateAdded - b.dateAdded,
  title: (a, b) => a.title.localeCompare(b.title),
  duration: (a, b) => b.duration - a.duration,
  lastWatched: (a, b) => (b.lastWatched ?? 0) - (a.lastWatched ?? 0),
  category: (a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
}

export function queryVideos(videos: Video[], query: LibraryQuery): Video[] {
  const { search = '', category = null, tag = null, watch = 'all', sort = 'recent' } = query
  let result = videos

  if (category) result = result.filter((v) => v.category === category)
  if (tag) result = result.filter((v) => v.tags.includes(tag))

  if (watch !== 'all') {
    result = result.filter((v) => {
      switch (watch) {
        case 'favorites':
          return v.favorite
        case 'completed':
          return v.completed
        case 'inProgress':
          return !v.completed && v.watchProgress > 1
        case 'unwatched':
          return !v.completed && v.watchProgress <= 1 && !v.lastWatched
      }
    })
  }

  const searched = search.trim() ? searchVideos(result, search.trim()) : result
  // Relevance order wins when a search term is present.
  return search.trim() ? searched : [...searched].sort(sorters[sort])
}

/**
 * Whether a video has enough unfinished progress to be worth resuming.
 * The floor is both absolute and relative so short clips — the common case in a
 * vertical feed — aren't permanently excluded by a seconds-only threshold.
 */
const RESUME_MIN_SECONDS = 3
const RESUME_MIN_FRACTION = 0.05
const RESUME_MAX_FRACTION = 0.95

export function hasResumableProgress(video: Video): boolean {
  if (video.completed || video.watchProgress <= 0) return false
  if (video.duration <= 0) return video.watchProgress > RESUME_MIN_SECONDS
  const fraction = video.watchProgress / video.duration
  if (fraction >= RESUME_MAX_FRACTION) return false
  return video.watchProgress >= RESUME_MIN_SECONDS || fraction >= RESUME_MIN_FRACTION
}

export function continueWatching(videos: Video[], limit = 12): Video[] {
  return videos
    .filter(hasResumableProgress)
    .sort((a, b) => (b.lastWatched ?? 0) - (a.lastWatched ?? 0))
    .slice(0, limit)
}

export function recentlyWatched(videos: Video[], limit = 12): Video[] {
  return videos
    .filter((v) => v.lastWatched)
    .sort((a, b) => (b.lastWatched ?? 0) - (a.lastWatched ?? 0))
    .slice(0, limit)
}

export function allTags(videos: Video[]): string[] {
  const counts = new Map<string, number>()
  for (const v of videos) for (const t of v.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map((e) => e[0])
}

export function categoryCounts(videos: Video[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const v of videos) counts.set(v.category, (counts.get(v.category) ?? 0) + 1)
  return counts
}

export interface LibraryStats {
  total: number
  favorites: number
  completed: number
  unwatched: number
  inProgress: number
  totalDuration: number
  totalWatchTime: number
  totalSize: number
}

export function libraryStats(videos: Video[], history: HistoryEntry[]): LibraryStats {
  return {
    total: videos.length,
    favorites: videos.filter((v) => v.favorite).length,
    completed: videos.filter((v) => v.completed).length,
    unwatched: videos.filter((v) => !v.lastWatched).length,
    inProgress: videos.filter(hasResumableProgress).length,
    totalDuration: videos.reduce((sum, v) => sum + v.duration, 0),
    totalWatchTime: history.reduce((sum, h) => sum + h.secondsWatched, 0),
    totalSize: videos.reduce((sum, v) => sum + v.size, 0),
  }
}

/** Fisher–Yates. Deterministic given a seeded rng, random by default. */
export function shuffled<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
