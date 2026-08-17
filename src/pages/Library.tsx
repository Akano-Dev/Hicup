import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Film, LayoutGrid, List, Play, Search, Shuffle, SlidersHorizontal, SquarePen, X } from 'lucide-react'
import { DropZone, ImportButton, ImportStatus } from '@/components/library/ImportButton'
import { VideoEditor } from '@/components/library/VideoEditor'
import { VideoCard, VideoRow } from '@/components/VideoCard'
import { Button, IconButton } from '@/components/ui/Button'
import { Chip, EmptyState, PageHeader, Stat } from '@/components/ui/Layout'
import { useLaunchFeed } from '@/hooks/useLaunchFeed'
import {
  categoryCounts,
  libraryStats,
  queryVideos,
  type SortKey,
  type WatchFilter,
} from '@/services/library'
import { useLibrary } from '@/store/library'
import { useQueue } from '@/store/queue'
import { useSettings } from '@/store/settings'
import type { Video } from '@/types'
import { formatDuration, formatWatchTime } from '@/utils/format'

const WATCH_FILTERS: Array<{ value: WatchFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unwatched', label: 'Unwatched' },
  { value: 'inProgress', label: 'In progress' },
  { value: 'completed', label: 'Watched' },
  { value: 'favorites', label: 'Favorites' },
]

/** Cards rendered per batch as the grid scrolls. */
const PAGE_SIZE = 60

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'recent', label: 'Recently added' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'duration', label: 'Longest' },
  { value: 'lastWatched', label: 'Recently watched' },
  { value: 'category', label: 'Category' },
]

export function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)

  const videos = useLibrary((s) => s.videos)
  const history = useLibrary((s) => s.history)
  const categories = useLibrary((s) => s.categories)
  const toggleFavorite = useLibrary((s) => s.toggleFavorite)
  const queueIds = useQueue((s) => s.ids)
  const addToQueue = useQueue((s) => s.add)
  const removeFromQueue = useQueue((s) => s.remove)
  const view = useSettings((s) => s.libraryView)
  const setSetting = useSettings((s) => s.set)
  const launch = useLaunchFeed()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [watch, setWatch] = useState<WatchFilter>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [editing, setEditing] = useState<Video | null>(null)

  // Deep links from the header search button and the feed's "edit details".
  useEffect(() => {
    if (params.get('focus') === 'search') {
      searchRef.current?.focus()
      params.delete('focus')
      setParams(params, { replace: true })
    }
    const editId = params.get('edit')
    if (editId) {
      const match = videos.find((v) => v.id === editId)
      if (match) setEditing(match)
      params.delete('edit')
      setParams(params, { replace: true })
    }
  }, [params, setParams, videos])

  const counts = useMemo(() => categoryCounts(videos), [videos])
  const stats = useMemo(() => libraryStats(videos, history), [videos, history])
  const results = useMemo(
    () => queryVideos(videos, { search, category, watch, sort }),
    [videos, search, category, watch, sort],
  )

  // Render in pages so a library of hundreds doesn't mount every card at once.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  useEffect(() => setVisibleCount(PAGE_SIZE), [search, category, watch, sort])
  const shown = useMemo(() => results.slice(0, visibleCount), [results, visibleCount])
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || visibleCount >= results.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((n) => n + PAGE_SIZE)
      },
      { rootMargin: '600px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, results.length])

  const sourceLabel = category ?? (search ? `Search: ${search}` : 'Library')

  const play = (startId?: string, shuffle = false) =>
    launch(results, {
      source: { kind: category ? 'category' : 'all', value: category ?? undefined, label: sourceLabel },
      startId,
      shuffle,
    })

  const visibleCategories = categories.filter((name) => counts.get(name))

  return (
    <>
      <DropZone />
      <PageHeader
        title="Library"
        subtitle={`${stats.total} ${stats.total === 1 ? 'video' : 'videos'} · ${formatWatchTime(stats.totalDuration)} of content`}
        actions={
          <>
            <Button variant="outline" onClick={() => play(undefined, true)} disabled={!results.length}>
              <Shuffle className="size-4" aria-hidden="true" />
              Shuffle
            </Button>
            <Button variant="outline" onClick={() => play()} disabled={!results.length}>
              <Play className="size-4" aria-hidden="true" />
              Play all
            </Button>
            <ImportButton />
          </>
        }
      />

      <ImportStatus />

      {videos.length > 0 && (
        <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Videos" value={stats.total} />
          <Stat label="Watch time" value={formatWatchTime(stats.totalWatchTime)} />
          <Stat label="Favorites" value={stats.favorites} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Unwatched" value={stats.unwatched} />
        </div>
      )}

      {videos.length > 0 && (
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles, tags, descriptions…"
                aria-label="Search library"
                className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-9 text-sm placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:text-text"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="relative">
              <SlidersHorizontal
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Sort videos"
                className="h-11 appearance-none rounded-xl border border-line bg-surface pl-9 pr-8 text-sm focus:border-accent/60 focus:outline-none"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex rounded-xl border border-line p-1">
              <IconButton
                label="Grid view"
                size="sm"
                active={view === 'grid'}
                onClick={() => setSetting('libraryView', 'grid')}
              >
                <LayoutGrid className="size-4" />
              </IconButton>
              <IconButton
                label="List view"
                size="sm"
                active={view === 'list'}
                onClick={() => setSetting('libraryView', 'list')}
              >
                <List className="size-4" />
              </IconButton>
            </div>
          </div>

          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {WATCH_FILTERS.map((filter) => (
              <Chip
                key={filter.value}
                active={watch === filter.value}
                onClick={() => setWatch(filter.value)}
              >
                {filter.label}
              </Chip>
            ))}
            <span className="mx-1 hidden w-px shrink-0 bg-line sm:block" aria-hidden="true" />
            <Chip active={category === null} onClick={() => setCategory(null)}>
              All categories
            </Chip>
            {visibleCategories.map((name) => (
              <Chip
                key={name}
                active={category === name}
                onClick={() => setCategory(category === name ? null : name)}
              >
                {name} <span className="text-xs opacity-60">{counts.get(name)}</span>
              </Chip>
            ))}
          </div>
        </div>
      )}

      {videos.length === 0 ? (
        <EmptyState
          icon={<Film className="size-6" />}
          title="Your library is empty"
          description="Add video files from this device. They stay on your machine — nothing is uploaded anywhere."
          action={<ImportButton size="lg" label="Add your first videos" />}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title="No matches"
          description="Try a different search term or clear the filters."
          action={
            <Button
              onClick={() => {
                setSearch('')
                setCategory(null)
                setWatch('all')
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onPlay={() => play(video.id)}
              onToggleFavorite={() => void toggleFavorite(video.id)}
              onQueue={() =>
                queueIds.includes(video.id) ? removeFromQueue(video.id) : addToQueue(video.id)
              }
              queued={queueIds.includes(video.id)}
              action={
                <button
                  type="button"
                  onClick={() => setEditing(video)}
                  aria-label={`Edit ${video.title}`}
                  className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white/85 backdrop-blur-sm transition hover:bg-black/80"
                >
                  <SquarePen className="size-4" aria-hidden="true" />
                </button>
              }
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {shown.map((video) => (
            <VideoRow
              key={video.id}
              video={video}
              onPlay={() => play(video.id)}
              subtitle={`${video.category} · ${formatDuration(video.duration)}${video.tags.length ? ` · ${video.tags.map((t) => `#${t}`).join(' ')}` : ''}`}
              right={
                <>
                  <IconButton
                    label={video.favorite ? 'Unfavorite' : 'Favorite'}
                    size="sm"
                    active={video.favorite}
                    onClick={() => void toggleFavorite(video.id)}
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill={video.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
                    </svg>
                  </IconButton>
                  <IconButton label="Edit details" size="sm" onClick={() => setEditing(video)}>
                    <SquarePen className="size-4" />
                  </IconButton>
                </>
              }
            />
          ))}
        </div>
      )}

      {shown.length < results.length && (
        <div ref={sentinelRef} className="py-8 text-center">
          <Button variant="ghost" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
            Show more ({results.length - shown.length} remaining)
          </Button>
        </div>
      )}

      <VideoEditor video={editing} onClose={() => setEditing(null)} />
    </>
  )
}
