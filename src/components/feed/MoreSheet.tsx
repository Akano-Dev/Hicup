import { useState } from 'react'
import { ChevronsDown, FolderPlus, Repeat, RotateCcw, SquarePen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useLibrary } from '@/store/library'
import { useSettings } from '@/store/settings'
import type { Video } from '@/types'
import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'

interface Props {
  open: boolean
  onClose: () => void
  video: Video
  onRestart: () => void
}

export function MoreSheet({ open, onClose, video, onRestart }: Props) {
  const navigate = useNavigate()
  const collections = useLibrary((s) => s.collections)
  const addToCollection = useLibrary((s) => s.addToCollection)
  const createCollection = useLibrary((s) => s.createCollection)
  const loop = useSettings((s) => s.loop)
  const autoAdvance = useSettings((s) => s.autoAdvance)
  const setSetting = useSettings((s) => s.set)
  const [picking, setPicking] = useState(false)
  const [newName, setNewName] = useState('')

  const rowClass =
    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition hover:bg-surface-2'

  return (
    <Modal open={open} onClose={onClose} title={video.title} description={formatDuration(video.duration)}>
      {picking ? (
        <div className="space-y-4">
          <div className="space-y-1">
            {collections.length === 0 && (
              <p className="py-2 text-sm text-muted">No collections yet — create one below.</p>
            )}
            {collections.map((collection) => {
              const already = collection.videoIds.includes(video.id)
              return (
                <button
                  key={collection.id}
                  type="button"
                  disabled={already}
                  onClick={async () => {
                    await addToCollection(collection.id, [video.id])
                    setPicking(false)
                    onClose()
                  }}
                  className={cn(rowClass, already && 'opacity-45')}
                >
                  <FolderPlus className="size-4 text-faint" aria-hidden="true" />
                  <span className="flex-1">{collection.name}</span>
                  <span className="text-xs text-faint">
                    {already ? 'Added' : `${collection.videoIds.length}`}
                  </span>
                </button>
              )
            })}
          </div>
          <form
            className="flex gap-2 border-t border-line pt-4"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!newName.trim()) return
              const collection = await createCollection(newName.trim())
              await addToCollection(collection.id, [video.id])
              setNewName('')
              setPicking(false)
              onClose()
            }}
          >
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="New collection name"
              className="flex-1 rounded-xl border border-line bg-bg-deep px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
            <Button type="submit" variant="primary" disabled={!newName.trim()}>
              Create
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-1">
          <button
            type="button"
            className={rowClass}
            onClick={() => {
              onRestart()
              onClose()
            }}
          >
            <RotateCcw className="size-4 text-faint" aria-hidden="true" />
            Restart video
          </button>
          <button
            type="button"
            className={rowClass}
            onClick={() => setSetting('autoAdvance', !autoAdvance)}
            aria-pressed={autoAdvance}
          >
            <ChevronsDown className="size-4 text-faint" aria-hidden="true" />
            <span className="flex-1">
              Auto-scroll
              <span className="block text-xs text-faint">Advance when the video finishes</span>
            </span>
            <span className={cn('text-xs', autoAdvance ? 'text-accent' : 'text-faint')}>
              {autoAdvance ? 'On' : 'Off'}
            </span>
          </button>
          <button
            type="button"
            className={rowClass}
            onClick={() => setSetting('loop', !loop)}
            aria-pressed={loop && !autoAdvance}
          >
            <Repeat className="size-4 text-faint" aria-hidden="true" />
            <span className="flex-1">
              Loop videos
              {autoAdvance && (
                <span className="block text-xs text-faint">Overridden by auto-scroll</span>
              )}
            </span>
            <span className={cn('text-xs', loop && !autoAdvance ? 'text-accent' : 'text-faint')}>
              {loop ? 'On' : 'Off'}
            </span>
          </button>
          <button type="button" className={rowClass} onClick={() => setPicking(true)}>
            <FolderPlus className="size-4 text-faint" aria-hidden="true" />
            Add to collection
          </button>
          <button
            type="button"
            className={rowClass}
            onClick={() => navigate(`/library?edit=${video.id}`)}
          >
            <SquarePen className="size-4 text-faint" aria-hidden="true" />
            Edit details in library
          </button>

          {video.description && (
            <p className="border-t border-line pt-4 text-sm leading-relaxed text-muted">
              {video.description}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
