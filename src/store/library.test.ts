import { beforeEach, describe, expect, it } from 'vitest'
import { useLibrary } from './library'
import { useQueue } from './queue'
import { useSettings } from './settings'
import { storage } from '@/services/storage/indexedDb'
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
    duration: 100,
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

beforeEach(async () => {
  await storage.init()
  await storage.reset()
  useSettings.getState().reset()
  useQueue.getState().clear()
  await useLibrary.getState().load()
})

describe('recordWatch', () => {
  it('saves the playback position and stamps lastWatched', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1')])
    await useLibrary.getState().recordWatch('v1', { position: 30, duration: 100, secondsWatched: 30 })

    const video = useLibrary.getState().videos.find((v) => v.id === 'v1')!
    expect(video.watchProgress).toBe(30)
    expect(video.completed).toBe(false)
    expect(video.lastWatched).toBeGreaterThan(0)
  })

  it('marks a video completed past the threshold and resets its resume point', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1')])
    await useLibrary.getState().recordWatch('v1', { position: 95, duration: 100, secondsWatched: 95 })

    const video = useLibrary.getState().videos.find((v) => v.id === 'v1')!
    expect(video.completed).toBe(true)
    expect(video.watchProgress).toBe(0)
    expect(video.playCount).toBe(1)
  })

  it('does not double-count playCount for an already-completed video', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1')])
    await useLibrary.getState().recordWatch('v1', { position: 99, duration: 100, secondsWatched: 99 })
    await useLibrary.getState().recordWatch('v1', { position: 99, duration: 100, secondsWatched: 99 })

    expect(useLibrary.getState().videos.find((v) => v.id === 'v1')!.playCount).toBe(1)
  })

  it('folds repeat plays of the same video into one history entry', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1')])
    await useLibrary.getState().recordWatch('v1', { position: 10, duration: 100, secondsWatched: 10 })
    await useLibrary.getState().recordWatch('v1', { position: 25, duration: 100, secondsWatched: 15 })

    const history = useLibrary.getState().history
    expect(history).toHaveLength(1)
    expect(history[0].secondsWatched).toBe(25)
    expect(history[0].progress).toBeCloseTo(0.25)
  })

  it('keeps separate history entries per video', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1'), makeVideo('v2')])
    await useLibrary.getState().recordWatch('v1', { position: 10, duration: 100, secondsWatched: 10 })
    await useLibrary.getState().recordWatch('v2', { position: 10, duration: 100, secondsWatched: 10 })

    expect(useLibrary.getState().history).toHaveLength(2)
  })

  it('survives a reload of the store', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1')])
    await useLibrary.getState().recordWatch('v1', { position: 42, duration: 100, secondsWatched: 42 })

    await useLibrary.getState().load()
    expect(useLibrary.getState().videos.find((v) => v.id === 'v1')!.watchProgress).toBe(42)
    expect(useLibrary.getState().history).toHaveLength(1)
  })
})

describe('deleteVideos', () => {
  it('removes the video from collections and history too', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1'), makeVideo('v2')])
    const collection = await useLibrary.getState().createCollection('Mix')
    await useLibrary.getState().addToCollection(collection.id, ['v1', 'v2'])
    await useLibrary.getState().recordWatch('v1', { position: 10, duration: 100, secondsWatched: 10 })

    await useLibrary.getState().deleteVideos(['v1'])

    const state = useLibrary.getState()
    expect(state.videos.map((v) => v.id)).toEqual(['v2'])
    expect(state.collections[0].videoIds).toEqual(['v2'])
    expect(state.history).toHaveLength(0)
  })
})

describe('queue consistency', () => {
  it('drops deleted videos from the queue', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1'), makeVideo('v2')])
    useQueue.getState().addMany(['v1', 'v2'])

    await useLibrary.getState().deleteVideos(['v1'])

    expect(useQueue.getState().ids).toEqual(['v2'])
  })
})

describe('collections', () => {
  it('adds without duplicating and preserves order on reorder', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1'), makeVideo('v2')])
    const collection = await useLibrary.getState().createCollection('Mix')

    await useLibrary.getState().addToCollection(collection.id, ['v1', 'v2'])
    await useLibrary.getState().addToCollection(collection.id, ['v1'])
    expect(useLibrary.getState().collections[0].videoIds).toEqual(['v1', 'v2'])

    await useLibrary.getState().reorderCollection(collection.id, ['v2', 'v1'])
    expect(useLibrary.getState().collections[0].videoIds).toEqual(['v2', 'v1'])

    await useLibrary.getState().removeFromCollection(collection.id, 'v2')
    expect(useLibrary.getState().collections[0].videoIds).toEqual(['v1'])
  })
})

describe('categories', () => {
  it('rejects duplicates case-insensitively', async () => {
    const before = useLibrary.getState().categories.length
    await useLibrary.getState().addCategory('gaming')
    expect(useLibrary.getState().categories).toHaveLength(before)
  })

  it('reassigns videos to Other when a category is removed', async () => {
    await useLibrary.getState().addRemoteVideos([makeVideo('v1', { category: 'Gaming' })])
    await useLibrary.getState().removeCategory('Gaming')

    expect(useLibrary.getState().categories).not.toContain('Gaming')
    expect(useLibrary.getState().videos[0].category).toBe('Other')
  })
})
