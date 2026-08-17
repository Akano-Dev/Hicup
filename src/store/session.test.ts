import { beforeEach, describe, expect, it } from 'vitest'
import { useSession } from './session'
import { useFeed } from './feed'
import { useQueue } from './queue'
import { storage } from '@/services/storage/indexedDb'

const source = { kind: 'all' as const, label: 'All videos' }

beforeEach(async () => {
  await storage.init()
  await storage.reset()
  useSession.setState({ active: null, finished: null })
  useFeed.getState().clear()
  useQueue.getState().clear()
})

describe('watch sessions', () => {
  it('accrues elapsed time and ends exactly when the planned time is up', () => {
    const { start, tick } = useSession.getState()
    start({ plannedSeconds: 3, source, shuffle: false, videoIds: ['v1'] })

    expect(useSession.getState().tick(1)).toBe(false)
    expect(useSession.getState().active!.elapsedSeconds).toBe(1)
    expect(useSession.getState().tick(1)).toBe(false)
    expect(useSession.getState().tick(1)).toBe(true)

    expect(useSession.getState().active).toBeNull()
    expect(useSession.getState().finished!.elapsedSeconds).toBe(3)
    void tick
  })

  it('never auto-ends an untimed session', () => {
    useSession.getState().start({ plannedSeconds: 0, source, shuffle: false, videoIds: ['v1'] })
    for (let i = 0; i < 100; i++) expect(useSession.getState().tick(60)).toBe(false)
    expect(useSession.getState().active).not.toBeNull()
  })

  it('records each watched video once', () => {
    useSession.getState().start({ plannedSeconds: 60, source, shuffle: false, videoIds: ['v1', 'v2'] })
    useSession.getState().markWatched('v1')
    useSession.getState().markWatched('v1')
    useSession.getState().markWatched('v2')

    expect(useSession.getState().active!.videosWatched).toEqual(['v1', 'v2'])
  })

  it('ending manually does not raise the completion screen', () => {
    useSession.getState().start({ plannedSeconds: 60, source, shuffle: false, videoIds: ['v1'] })
    useSession.getState().end()

    expect(useSession.getState().active).toBeNull()
    expect(useSession.getState().finished).toBeNull()
  })
})

describe('feed store', () => {
  it('starts at the chosen video', () => {
    useFeed.getState().setPlaylist({ playlist: ['a', 'b', 'c'], source, startId: 'b' })
    expect(useFeed.getState().index).toBe(1)
  })

  it('clamps index changes to the playlist bounds', () => {
    useFeed.getState().setPlaylist({ playlist: ['a', 'b'], source })
    useFeed.getState().setIndex(9)
    expect(useFeed.getState().index).toBe(1)
    useFeed.getState().setIndex(-3)
    expect(useFeed.getState().index).toBe(0)
  })

  it('keeps the current video selected when others are pruned', () => {
    useFeed.getState().setPlaylist({ playlist: ['a', 'b', 'c'], source, startId: 'c' })
    useFeed.getState().prune(new Set(['b', 'c']))

    expect(useFeed.getState().playlist).toEqual(['b', 'c'])
    expect(useFeed.getState().index).toBe(1)
  })

  it('falls back to a valid index when the current video is pruned', () => {
    useFeed.getState().setPlaylist({ playlist: ['a', 'b', 'c'], source, startId: 'c' })
    useFeed.getState().prune(new Set(['a']))

    expect(useFeed.getState().playlist).toEqual(['a'])
    expect(useFeed.getState().index).toBe(0)
  })
})

describe('queue store', () => {
  it('ignores duplicates and reorders within bounds', () => {
    const queue = useQueue.getState()
    queue.addMany(['a', 'b', 'c'])
    queue.add('a')
    expect(useQueue.getState().ids).toEqual(['a', 'b', 'c'])

    useQueue.getState().move('c', -1)
    expect(useQueue.getState().ids).toEqual(['a', 'c', 'b'])

    useQueue.getState().move('a', -1)
    expect(useQueue.getState().ids).toEqual(['a', 'c', 'b'])

    useQueue.getState().remove('c')
    expect(useQueue.getState().ids).toEqual(['a', 'b'])
  })
})
