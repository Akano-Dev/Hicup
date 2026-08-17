import { useMemo } from 'react'
import { ArrowDown, ArrowUp, Play, Sparkles, Trash2 } from 'lucide-react'
import { VideoRow } from '@/components/VideoCard'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Layout'
import { useLaunchFeed } from '@/hooks/useLaunchFeed'
import { useLibrary } from '@/store/library'
import { useQueue } from '@/store/queue'
import { formatDuration } from '@/utils/format'

export function QueuePage() {
  const videos = useLibrary((s) => s.videos)
  const ids = useQueue((s) => s.ids)
  const remove = useQueue((s) => s.remove)
  const move = useQueue((s) => s.move)
  const clear = useQueue((s) => s.clear)
  const launch = useLaunchFeed()

  const items = useMemo(
    () => ids.map((id) => videos.find((v) => v.id === id)).filter((v) => v !== undefined),
    [ids, videos],
  )
  const total = items.reduce((sum, v) => sum + v.duration, 0)
  const source = { kind: 'queue' as const, label: 'Queue' }

  return (
    <>
      <PageHeader
        title="Queue"
        subtitle={
          items.length
            ? `${items.length} ${items.length === 1 ? 'video' : 'videos'} · ${formatDuration(total)} — a temporary list, cleared whenever you like`
            : 'A temporary list for what you want to watch next.'
        }
        actions={
          items.length > 0 && (
            <>
              <Button variant="ghost" onClick={clear}>
                Clear
              </Button>
              <Button variant="primary" onClick={() => launch(items, { source })}>
                <Play className="size-4 fill-current" aria-hidden="true" />
                Play queue
              </Button>
            </>
          )
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Queue is empty"
          description="Add videos from the library or straight from the feed to line up what you want to watch."
        />
      ) : (
        <div className="space-y-1">
          {items.map((video, index) => (
            <VideoRow
              key={video.id}
              video={video}
              index={index}
              onPlay={() => launch(items, { source, startId: video.id })}
              right={
                <>
                  <IconButton
                    label="Move up"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(video.id, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    size="sm"
                    disabled={index === items.length - 1}
                    onClick={() => move(video.id, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Remove ${video.title} from queue`}
                    size="sm"
                    onClick={() => remove(video.id)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </>
              }
            />
          ))}
        </div>
      )}
    </>
  )
}
