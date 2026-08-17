import { describe, expect, it } from 'vitest'
import {
  categoryCounts,
  continueWatching,
  libraryStats,
  queryVideos,
  searchVideos,
  shuffled,
} from './library'
import type { HistoryEntry, Video } from '@/types'

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Untitled',
    description: '',
    filename: 'clip.mp4',
    mimeType: 'video/mp4',
    size: 1000,
    sourceKind: 'blob',
    duration: 100,
    category: 'Other',
    tags: [],
    dateAdded: 1000,
    watchProgress: 0,
    completed: false,
    favorite: false,
    playCount: 0,
    ...overrides,
  }
}

const library: Video[] = [
  makeVideo({
    id: 'a',
    title: 'Python Async Programming',
    category: 'Programming',
    tags: ['python', 'async'],
    dateAdded: 3000,
    duration: 600,
  }),
  makeVideo({
    id: 'b',
    title: 'FastAPI Guide',
    description: 'Building APIs with python',
    category: 'Programming',
    tags: ['api'],
    dateAdded: 2000,
    duration: 300,
  }),
  makeVideo({
    id: 'c',
    title: 'Minecraft Hardcore',
    category: 'Gaming',
    tags: ['minecraft'],
    dateAdded: 1000,
    favorite: true,
    completed: true,
    duration: 900,
  }),
]

describe('searchVideos', () => {
  it('matches titles, tags and descriptions', () => {
    const ids = searchVideos(library, 'python').map((v) => v.id)
    expect(ids).toEqual(['a', 'b'])
  })

  it('ranks title matches above description matches', () => {
    expect(searchVideos(library, 'python')[0].id).toBe('a')
  })

  it('narrows rather than widens with multiple terms', () => {
    expect(searchVideos(library, 'python guide').map((v) => v.id)).toEqual(['b'])
  })

  it('returns everything for an empty query', () => {
    expect(searchVideos(library, '')).toHaveLength(3)
  })

  it('is case insensitive', () => {
    expect(searchVideos(library, 'MINECRAFT').map((v) => v.id)).toEqual(['c'])
  })
})

describe('queryVideos', () => {
  it('filters by category', () => {
    expect(queryVideos(library, { category: 'Gaming' }).map((v) => v.id)).toEqual(['c'])
  })

  it('filters by watch state', () => {
    expect(queryVideos(library, { watch: 'completed' }).map((v) => v.id)).toEqual(['c'])
    expect(queryVideos(library, { watch: 'favorites' }).map((v) => v.id)).toEqual(['c'])
    expect(queryVideos(library, { watch: 'unwatched' }).map((v) => v.id)).toEqual(['a', 'b'])
  })

  it('sorts by the requested key', () => {
    expect(queryVideos(library, { sort: 'title' }).map((v) => v.id)).toEqual(['b', 'c', 'a'])
    expect(queryVideos(library, { sort: 'oldest' }).map((v) => v.id)).toEqual(['c', 'b', 'a'])
    expect(queryVideos(library, { sort: 'duration' }).map((v) => v.id)).toEqual(['c', 'a', 'b'])
  })

  it('combines search with filters', () => {
    const result = queryVideos(library, { search: 'python', category: 'Programming' })
    expect(result.map((v) => v.id)).toEqual(['a', 'b'])
  })

  it('keeps relevance order when searching, ignoring the sort key', () => {
    const result = queryVideos(library, { search: 'python', sort: 'oldest' })
    expect(result[0].id).toBe('a')
  })
})

describe('continueWatching', () => {
  it('includes only meaningfully unfinished videos', () => {
    const videos = [
      makeVideo({ id: 'barely', watchProgress: 2, duration: 100, lastWatched: 5 }),
      makeVideo({ id: 'midway', watchProgress: 40, duration: 100, lastWatched: 10 }),
      makeVideo({ id: 'almost', watchProgress: 99, duration: 100, lastWatched: 20 }),
      makeVideo({ id: 'done', watchProgress: 50, duration: 100, completed: true, lastWatched: 30 }),
    ]
    expect(continueWatching(videos).map((v) => v.id)).toEqual(['midway'])
  })

  it('orders by most recently watched', () => {
    const videos = [
      makeVideo({ id: 'older', watchProgress: 30, duration: 100, lastWatched: 1 }),
      makeVideo({ id: 'newer', watchProgress: 30, duration: 100, lastWatched: 2 }),
    ]
    expect(continueWatching(videos).map((v) => v.id)).toEqual(['newer', 'older'])
  })
})

describe('libraryStats', () => {
  it('counts library state and sums watch time from history', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', videoId: 'a', watchedAt: 1, secondsWatched: 60, progress: 0.5, completed: false },
      { id: 'h2', videoId: 'c', watchedAt: 2, secondsWatched: 90, progress: 1, completed: true },
    ]
    const stats = libraryStats(library, history)
    expect(stats).toMatchObject({
      total: 3,
      favorites: 1,
      completed: 1,
      unwatched: 3,
      totalDuration: 1800,
      totalWatchTime: 150,
    })
  })
})

describe('categoryCounts', () => {
  it('tallies videos per category', () => {
    expect([...categoryCounts(library).entries()]).toEqual([
      ['Programming', 2],
      ['Gaming', 1],
    ])
  })
})

describe('shuffled', () => {
  it('preserves every element', () => {
    const input = [1, 2, 3, 4, 5]
    expect([...shuffled(input)].sort()).toEqual(input)
  })

  it('does not mutate its input', () => {
    const input = [1, 2, 3]
    shuffled(input, () => 0)
    expect(input).toEqual([1, 2, 3])
  })
})
