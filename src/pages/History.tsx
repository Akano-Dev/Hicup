import { useMemo, useState } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import { VideoRow } from '@/components/VideoCard'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, PageHeader, Stat } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { useLaunchFeed } from '@/hooks/useLaunchFeed'
import { useLibrary } from '@/store/library'
import { formatRelativeDate, formatWatchTime } from '@/utils/format'

export function HistoryPage() {
  const videos = useLibrary((s) => s.videos)
  const history = useLibrary((s) => s.history)
  const deleteEntry = useLibrary((s) => s.deleteHistoryEntry)
  const clearHistory = useLibrary((s) => s.clearHistory)
  const launch = useLaunchFeed()
  const [confirmClear, setConfirmClear] = useState(false)

  const byId = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos])
  const entries = useMemo(
    () => history.map((h) => ({ entry: h, video: byId.get(h.videoId) })).filter((x) => x.video),
    [history, byId],
  )
  const totalWatched = history.reduce((sum, h) => sum + h.secondsWatched, 0)

  return (
    <>
      <PageHeader
        title="History"
        subtitle="Private to this device — nothing leaves your browser."
        actions={
          entries.length > 0 && (
            <Button variant="danger" onClick={() => setConfirmClear(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Clear history
            </Button>
          )
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<Clock className="size-6" />}
          title="Nothing watched yet"
          description="Once you start a session, what you watch shows up here with your position saved."
        />
      ) : (
        <>
          <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Entries" value={entries.length} />
            <Stat label="Watch time" value={formatWatchTime(totalWatched)} />
            <Stat label="Completed" value={history.filter((h) => h.completed).length} />
          </div>

          <div className="space-y-1">
            {entries.map(({ entry, video }) => (
              <VideoRow
                key={entry.id}
                video={video!}
                onPlay={() =>
                  launch(
                    entries.map((x) => x.video!),
                    { source: { kind: 'all', label: 'History' }, startId: video!.id },
                  )
                }
                subtitle={`${Math.round(entry.progress * 100)}% watched · ${formatRelativeDate(entry.watchedAt)} · ${formatWatchTime(entry.secondsWatched)}`}
                right={
                  <IconButton
                    label={`Remove ${video!.title} from history`}
                    size="sm"
                    onClick={() => void deleteEntry(entry.id)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                }
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear watch history?"
        description="Playback positions on individual videos are kept; only the history log is removed."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearHistory()
                setConfirmClear(false)
              }}
            >
              Clear history
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">This can’t be undone.</p>
      </Modal>
    </>
  )
}
