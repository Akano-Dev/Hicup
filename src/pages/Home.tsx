import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Film, Play, Shuffle, Sparkles } from 'lucide-react'
import { DropZone, ImportButton, ImportStatus } from '@/components/library/ImportButton'
import { SessionStarter } from '@/components/session/SessionStarter'
import { Thumbnail, ProgressBar, VideoCard } from '@/components/VideoCard'
import { Button } from '@/components/ui/Button'
import { Chip, EmptyState, Section, Shelf } from '@/components/ui/Layout'
import { useLaunchFeed } from '@/hooks/useLaunchFeed'
import { canGenerateDemo, generateDemoLibrary } from '@/services/demo'
import { categoryCounts, continueWatching } from '@/services/library'
import { useLibrary } from '@/store/library'
import { useQueue } from '@/store/queue'
import { useSession } from '@/store/session'
import { formatDuration, formatRelativeDate, greeting } from '@/utils/format'

function ContinueCard({ video, onPlay }: { video: import('@/types').Video; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group w-60 shrink-0 snap-start text-left sm:w-72"
      aria-label={`Resume ${video.title}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-card border border-line/60 bg-bg-deep">
        <Thumbnail video={video} className="size-full transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-on-accent">
            <Play className="size-5 translate-x-px fill-current" aria-hidden="true" />
          </span>
        </span>
        <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums text-white/85">
          {formatDuration(Math.max(0, video.duration - video.watchProgress))} left
        </span>
        <ProgressBar video={video} className="absolute bottom-0 left-0" />
      </div>
      <p className="mt-2.5 truncate text-sm font-medium">{video.title}</p>
      <p className="text-xs text-faint">
        {video.lastWatched ? formatRelativeDate(video.lastWatched) : video.category}
      </p>
    </button>
  )
}

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const videos = useLibrary((s) => s.videos)
  const collections = useLibrary((s) => s.collections)
  const addRemoteVideos = useLibrary((s) => s.addRemoteVideos)
  const toggleFavorite = useLibrary((s) => s.toggleFavorite)
  const queueIds = useQueue((s) => s.ids)
  const activeSession = useSession((s) => s.active)
  const launch = useLaunchFeed()

  const [starterOpen, setStarterOpen] = useState(false)
  const [demoProgress, setDemoProgress] = useState<number | null>(null)

  // "Start another session" from the completion screen lands here.
  useEffect(() => {
    if (params.get('session') === '1') {
      setStarterOpen(true)
      params.delete('session')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const resume = useMemo(() => continueWatching(videos), [videos])
  const favorites = useMemo(() => videos.filter((v) => v.favorite).slice(0, 12), [videos])
  const recent = useMemo(() => videos.slice(0, 12), [videos])
  const counts = useMemo(() => categoryCounts(videos), [videos])

  const loadDemo = async () => {
    setDemoProgress(0)
    const created = await generateDemoLibrary((done, total) =>
      setDemoProgress(Math.round((done / total) * 100)),
    )
    await addRemoteVideos(created)
    setDemoProgress(null)
  }

  if (videos.length === 0) {
    return (
      <>
        <DropZone />
        <div className="mx-auto max-w-xl py-10 text-center">
          <h1 className="text-3xl font-semibold">Your videos. Your feed.</h1>
          <p className="mt-3 text-balance text-sm leading-relaxed text-muted">
            Hicup turns the videos on your own device into a smooth vertical feed — no accounts, no
            recommendations, no algorithm. Everything stays local to this browser.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <ImportButton size="lg" label="Add videos" />
            {canGenerateDemo() && (
              <Button variant="ghost" onClick={loadDemo} disabled={demoProgress !== null}>
                {demoProgress === null
                  ? 'Or try three generated demo clips'
                  : `Generating demo clips… ${demoProgress}%`}
              </Button>
            )}
          </div>
          <ImportStatus />
        </div>
      </>
    )
  }

  return (
    <>
      <DropZone />
      <ImportStatus />

      <section className="mb-10">
        <p className="text-sm text-muted">{greeting()}.</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">What do you want to watch?</h1>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button variant="primary" size="lg" onClick={() => setStarterOpen(true)}>
            <Play className="size-4 fill-current" aria-hidden="true" />
            Start watching
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => launch(videos, { source: { kind: 'all', label: 'All videos' }, shuffle: true })}
          >
            <Shuffle className="size-4" aria-hidden="true" />
            Shuffle everything
          </Button>
          {activeSession && (
            <Button
              size="lg"
              variant="secondary"
              onClick={() =>
                launch(activeSession.videoIds, {
                  source: activeSession.source,
                  shuffle: activeSession.shuffle,
                })
              }
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Resume session
            </Button>
          )}
        </div>
      </section>

      {resume.length > 0 && (
        <Section
          title="Continue watching"
          action={
            <button
              type="button"
              onClick={() => launch(resume, { source: { kind: 'all', label: 'Continue watching' } })}
              className="flex items-center gap-1 text-xs text-muted transition hover:text-text"
            >
              Play all <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          }
        >
          <Shelf>
            {resume.map((video) => (
              <ContinueCard
                key={video.id}
                video={video}
                onPlay={() =>
                  launch(resume, {
                    source: { kind: 'all', label: 'Continue watching' },
                    startId: video.id,
                  })
                }
              />
            ))}
          </Shelf>
        </Section>
      )}

      {favorites.length > 0 && (
        <Section
          title="Favorites"
          action={
            <Link to="/favorites" className="flex items-center gap-1 text-xs text-muted transition hover:text-text">
              See all <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <Shelf>
            {favorites.map((video) => (
              <div key={video.id} className="w-36 shrink-0 snap-start sm:w-44">
                <VideoCard
                  video={video}
                  onPlay={() =>
                    launch(favorites, {
                      source: { kind: 'favorites', label: 'Favorites' },
                      startId: video.id,
                    })
                  }
                  onToggleFavorite={() => void toggleFavorite(video.id)}
                  queued={queueIds.includes(video.id)}
                />
              </div>
            ))}
          </Shelf>
        </Section>
      )}

      <Section
        title="Recently added"
        action={
          <Link to="/library" className="flex items-center gap-1 text-xs text-muted transition hover:text-text">
            Library <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      >
        <Shelf>
          {recent.map((video) => (
            <div key={video.id} className="w-36 shrink-0 snap-start sm:w-44">
              <VideoCard
                video={video}
                onPlay={() =>
                  launch(recent, { source: { kind: 'all', label: 'Recently added' }, startId: video.id })
                }
                onToggleFavorite={() => void toggleFavorite(video.id)}
                queued={queueIds.includes(video.id)}
              />
            </div>
          ))}
        </Shelf>
      </Section>

      {collections.length > 0 && (
        <Section
          title="Collections"
          action={
            <Link to="/collections" className="flex items-center gap-1 text-xs text-muted transition hover:text-text">
              See all <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collections.slice(0, 3).map((collection) => (
              <Link
                key={collection.id}
                to={`/collections/${collection.id}`}
                className="rounded-card border border-line/70 bg-surface px-4 py-4 transition hover:border-line hover:bg-surface-2"
              >
                <p className="font-medium">{collection.name}</p>
                <p className="mt-0.5 text-xs text-faint">
                  {collection.videoIds.length} {collection.videoIds.length === 1 ? 'video' : 'videos'}
                </p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Categories">
        <div className="flex flex-wrap gap-2">
          {[...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => (
              <Chip
                key={name}
                onClick={() =>
                  launch(
                    videos.filter((v) => v.category === name),
                    { source: { kind: 'category', value: name, label: name } },
                  )
                }
              >
                {name} <span className="text-xs opacity-60">{count}</span>
              </Chip>
            ))}
        </div>
      </Section>

      {videos.length < 3 && (
        <EmptyState
          icon={<Film className="size-6" />}
          title="Add more videos"
          description="The feed feels best with a handful of clips. Drag files anywhere onto this window to add them."
          action={<ImportButton />}
        />
      )}

      <SessionStarter open={starterOpen} onClose={() => setStarterOpen(false)} />
    </>
  )
}
