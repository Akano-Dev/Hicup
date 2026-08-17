import { beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbAdapter } from './indexedDb'
import type { Video } from '@/types'

function makeVideo(id: string, overrides: Partial<Video> = {}): Video {
  return {
    id,
    title: id,
    description: '',
    filename: `${id}.mp4`,
    mimeType: 'video/mp4',
    size: 10,
    sourceKind: 'blob',
    duration: 30,
    category: 'Other',
    tags: [],
    dateAdded: Date.now(),
    watchProgress: 0,
    completed: false,
    favorite: false,
    playCount: 0,
    ...overrides,
  }
}

let storage: IndexedDbAdapter

beforeEach(async () => {
  // fake-indexeddb keeps state between tests; start each one from a clean db.
  storage = new IndexedDbAdapter()
  await storage.init()
  await storage.reset()
})

describe('IndexedDbAdapter', () => {
  it('round-trips videos', async () => {
    await storage.putVideo(makeVideo('v1', { title: 'First' }))
    expect((await storage.getVideo('v1'))?.title).toBe('First')
    expect(await storage.listVideos()).toHaveLength(1)
  })

  it('updates an existing video in place', async () => {
    await storage.putVideo(makeVideo('v1'))
    await storage.putVideo(makeVideo('v1', { title: 'Renamed', favorite: true }))
    const videos = await storage.listVideos()
    expect(videos).toHaveLength(1)
    expect(videos[0]).toMatchObject({ title: 'Renamed', favorite: true })
  })

  it('deletes the media blob alongside the video record', async () => {
    const video = makeVideo('v1')
    await storage.putVideo(video)
    await storage.putMedia('v1', new Blob(['data'], { type: 'video/mp4' }))
    expect(await storage.resolveMediaUrl(video)).toMatch(/^blob:/)

    await storage.deleteVideo('v1')
    expect(await storage.getVideo('v1')).toBeUndefined()
    expect(await storage.resolveMediaUrl(video)).toBeUndefined()
  })

  it('returns a stable url for repeated resolves of the same video', async () => {
    const video = makeVideo('v1')
    await storage.putVideo(video)
    await storage.putMedia('v1', new Blob(['data']))
    expect(await storage.resolveMediaUrl(video)).toBe(await storage.resolveMediaUrl(video))
  })

  it('passes through url-backed sources without touching the media store', async () => {
    const video = makeVideo('v1', { sourceKind: 'url', sourceUrl: 'https://example.test/a.mp4' })
    expect(await storage.resolveMediaUrl(video)).toBe('https://example.test/a.mp4')
  })

  it('reports missing media rather than throwing', async () => {
    expect(await storage.resolveMediaUrl(makeVideo('ghost'))).toBeUndefined()
  })

  it('evicts the least recently used object url beyond the cache limit', async () => {
    const revoked: string[] = []
    const original = URL.revokeObjectURL
    URL.revokeObjectURL = (url: string) => revoked.push(url)

    const videos = Array.from({ length: 12 }, (_, i) => makeVideo(`v${i}`))
    for (const video of videos) {
      await storage.putVideo(video)
      await storage.putMedia(video.id, new Blob([video.id]))
    }
    for (const video of videos) await storage.resolveMediaUrl(video)

    URL.revokeObjectURL = original
    expect(revoked.length).toBe(2)
  })

  it('stores and clears history', async () => {
    await storage.putHistory({
      id: 'h1',
      videoId: 'v1',
      watchedAt: 1,
      secondsWatched: 5,
      progress: 0.1,
      completed: false,
    })
    expect(await storage.listHistory()).toHaveLength(1)
    await storage.clearHistory()
    expect(await storage.listHistory()).toHaveLength(0)
  })

  it('persists collections and categories', async () => {
    await storage.putCollection({
      id: 'c1',
      name: 'Study Break',
      description: '',
      videoIds: ['v1'],
      createdAt: 1,
      updatedAt: 1,
    })
    expect((await storage.listCollections())[0].name).toBe('Study Break')

    await storage.putCategories(['Gaming', 'Learning'])
    expect(await storage.getCategories()).toEqual(['Gaming', 'Learning'])
  })

  it('wipes every store on reset', async () => {
    await storage.putVideo(makeVideo('v1'))
    await storage.putCategories(['Gaming'])
    await storage.reset()
    expect(await storage.listVideos()).toHaveLength(0)
    expect(await storage.getCategories()).toBeUndefined()
  })
})
