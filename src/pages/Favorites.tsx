import { useMemo } from 'react'
import { Heart, Play, Shuffle } from 'lucide-react'
import { VideoCard } from '@/components/VideoCard'
import { Button } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Layout'
import { useLaunchFeed } from '@/hooks/useLaunchFeed'
import { useLibrary } from '@/store/library'
import { useQueue } from '@/store/queue'

export function FavoritesPage() {
  const videos = useLibrary((s) => s.videos)
  const toggleFavorite = useLibrary((s) => s.toggleFavorite)
  const queueIds = useQueue((s) => s.ids)
  const addToQueue = useQueue((s) => s.add)
  const removeFromQueue = useQueue((s) => s.remove)
  const launch = useLaunchFeed()

  const favorites = useMemo(() => videos.filter((v) => v.favorite), [videos])
  const source = { kind: 'favorites' as const, label: 'Favorites' }

  return (
    <>
      <PageHeader
        title="Favorites"
        subtitle={`${favorites.length} ${favorites.length === 1 ? 'video' : 'videos'} you marked to keep close`}
        actions={
          favorites.length > 0 && (
            <>
              <Button variant="outline" onClick={() => launch(favorites, { source, shuffle: true })}>
                <Shuffle className="size-4" aria-hidden="true" />
                Shuffle
              </Button>
              <Button variant="primary" onClick={() => launch(favorites, { source })}>
                <Play className="size-4 fill-current" aria-hidden="true" />
                Play all
              </Button>
            </>
          )
        }
      />

      {favorites.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" />}
          title="No favorites yet"
          description="Tap the heart on any video — in the feed or the library — to keep it here."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {favorites.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onPlay={() => launch(favorites, { source, startId: video.id })}
              onToggleFavorite={() => void toggleFavorite(video.id)}
              onQueue={() =>
                queueIds.includes(video.id) ? removeFromQueue(video.id) : addToQueue(video.id)
              }
              queued={queueIds.includes(video.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}
