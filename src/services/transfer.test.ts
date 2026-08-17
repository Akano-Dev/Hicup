import { describe, expect, it } from 'vitest'
import { buildExport, parseImport } from './transfer'
import { DEFAULT_SETTINGS, type Video } from '@/types'

const video: Video = {
  id: 'v1',
  title: 'Python Async Programming',
  description: 'notes',
  filename: 'python.mp4',
  mimeType: 'video/mp4',
  size: 1234,
  sourceKind: 'blob',
  thumbnail: 'data:image/jpeg;base64,AAAA',
  duration: 600,
  category: 'Programming',
  tags: ['python'],
  dateAdded: 1000,
  lastWatched: 2000,
  watchProgress: 42,
  completed: false,
  favorite: true,
  playCount: 2,
}

const base = {
  videos: [video],
  collections: [
    { id: 'c1', name: 'Study Break', description: '', videoIds: ['v1'], createdAt: 1, updatedAt: 2 },
  ],
  history: [
    { id: 'h1', videoId: 'v1', watchedAt: 5, secondsWatched: 60, progress: 0.5, completed: false },
  ],
  sessions: [],
  settings: DEFAULT_SETTINGS,
}

describe('export / import', () => {
  it('round-trips a library without losing organisation', () => {
    const exported = buildExport({ ...base, includeThumbnails: true })
    const parsed = parseImport(JSON.stringify(exported))

    expect(parsed.videos[0]).toMatchObject({
      id: 'v1',
      title: 'Python Async Programming',
      category: 'Programming',
      tags: ['python'],
      favorite: true,
      watchProgress: 42,
    })
    expect(parsed.collections[0].videoIds).toEqual(['v1'])
    expect(parsed.history).toHaveLength(1)
  })

  it('omits thumbnails when asked, keeping the file small', () => {
    const exported = buildExport({ ...base, includeThumbnails: false })
    expect(exported.videos[0].thumbnail).toBeUndefined()
    expect(JSON.stringify(exported)).not.toContain('base64')
  })

  it('never carries media bytes', () => {
    const exported = buildExport({ ...base, includeThumbnails: true })
    expect(exported).not.toHaveProperty('media')
    expect(JSON.stringify(exported)).not.toContain('blob:')
  })

  it('fills in defaults for partial records', () => {
    const parsed = parseImport(JSON.stringify({ videos: [{ id: 'x' }] }))
    expect(parsed.videos[0]).toMatchObject({
      id: 'x',
      title: 'Untitled',
      category: 'Other',
      tags: [],
      watchProgress: 0,
      completed: false,
    })
  })

  it('drops records without an id', () => {
    const parsed = parseImport(JSON.stringify({ videos: [{ title: 'no id' }, { id: 'ok' }] }))
    expect(parsed.videos.map((v) => v.id)).toEqual(['ok'])
  })

  it('ignores unknown settings keys', () => {
    const parsed = parseImport(
      JSON.stringify({ videos: [{ id: 'x' }], settings: { volume: 0.5, evil: true } }),
    )
    expect(parsed.settings).toEqual({ volume: 0.5 })
  })

  it('rejects files that are not library exports', () => {
    expect(() => parseImport('{"hello":"world"}')).toThrow(/No library data/)
    expect(() => parseImport('[]')).toThrow(/not a Hicup export/)
    expect(() => parseImport('not json')).toThrow()
  })
})
