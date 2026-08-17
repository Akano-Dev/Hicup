import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers, Plus } from 'lucide-react'
import { Thumbnail } from '@/components/VideoCard'
import { Button } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { TextArea, TextField } from '@/components/ui/Field'
import { useLibrary } from '@/store/library'
import { formatRelativeDate } from '@/utils/format'

export function CollectionsPage() {
  const collections = useLibrary((s) => s.collections)
  const videos = useLibrary((s) => s.videos)
  const createCollection = useLibrary((s) => s.createCollection)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const create = async () => {
    if (!name.trim()) return
    await createCollection(name.trim(), description.trim())
    setName('')
    setDescription('')
    setOpen(false)
  }

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle="Group videos however makes sense to you."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New collection
          </Button>
        }
      />

      {collections.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" />}
          title="No collections yet"
          description="Collections are your own playlists — Study Break, Weekend Videos, whatever you like."
          action={
            <Button variant="primary" onClick={() => setOpen(true)}>
              Create a collection
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => {
            const covers = collection.videoIds
              .map((id) => videos.find((v) => v.id === id))
              .filter((v) => v !== undefined)
              .slice(0, 3)
            return (
              <Link
                key={collection.id}
                to={`/collections/${collection.id}`}
                className="group overflow-hidden rounded-card border border-line/70 bg-surface transition hover:-translate-y-0.5 hover:border-line hover:shadow-xl hover:shadow-black/30"
              >
                <div className="flex aspect-[16/7] gap-0.5 bg-bg-deep">
                  {covers.length === 0 ? (
                    <div className="flex w-full items-center justify-center text-faint">
                      <Layers className="size-6" aria-hidden="true" />
                    </div>
                  ) : (
                    covers.map((video) => (
                      <Thumbnail key={video.id} video={video} className="h-full flex-1" />
                    ))
                  )}
                </div>
                <div className="p-4">
                  <p className="font-medium">{collection.name}</p>
                  <p className="mt-0.5 text-xs text-faint">
                    {collection.videoIds.length}{' '}
                    {collection.videoIds.length === 1 ? 'video' : 'videos'} ·{' '}
                    {formatRelativeDate(collection.updatedAt)}
                  </p>
                  {collection.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{collection.description}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New collection"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={create} disabled={!name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Study Break"
            data-autofocus
          />
          <TextArea
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional"
          />
        </div>
      </Modal>
    </>
  )
}
