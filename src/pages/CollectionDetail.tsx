import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Layers, Play, Plus, Shuffle, Trash2 } from 'lucide-react'
import { VideoRow } from '@/components/VideoCard'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { TextArea, TextField } from '@/components/ui/Field'
import { useLaunchFeed } from '@/hooks/useLaunchFeed'
import { queryVideos } from '@/services/library'
import { useLibrary } from '@/store/library'
import { formatDuration } from '@/utils/format'

export function CollectionDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const collections = useLibrary((s) => s.collections)
  const videos = useLibrary((s) => s.videos)
  const updateCollection = useLibrary((s) => s.updateCollection)
  const deleteCollection = useLibrary((s) => s.deleteCollection)
  const addToCollection = useLibrary((s) => s.addToCollection)
  const removeFromCollection = useLibrary((s) => s.removeFromCollection)
  const reorderCollection = useLibrary((s) => s.reorderCollection)
  const launch = useLaunchFeed()

  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const collection = collections.find((c) => c.id === id)

  const items = useMemo(
    () =>
      collection?.videoIds
        .map((videoId) => videos.find((v) => v.id === videoId))
        .filter((v) => v !== undefined) ?? [],
    [collection, videos],
  )

  const candidates = useMemo(
    () =>
      queryVideos(
        videos.filter((v) => !collection?.videoIds.includes(v.id)),
        { search },
      ).slice(0, 60),
    [videos, collection, search],
  )

  if (!collection) {
    return (
      <EmptyState
        icon={<Layers className="size-6" />}
        title="Collection not found"
        description="It may have been deleted."
        action={
          <Link to="/collections">
            <Button>Back to collections</Button>
          </Link>
        }
      />
    )
  }

  const source = { kind: 'collection' as const, value: collection.id, label: collection.name }
  const totalDuration = items.reduce((sum, v) => sum + v.duration, 0)

  const move = (videoId: string, direction: -1 | 1) => {
    const index = collection.videoIds.indexOf(videoId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= collection.videoIds.length) return
    const next = [...collection.videoIds]
    ;[next[index], next[target]] = [next[target], next[index]]
    void reorderCollection(collection.id, next)
  }

  return (
    <>
      <Link
        to="/collections"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Collections
      </Link>

      <PageHeader
        title={collection.name}
        subtitle={
          <>
            {items.length} {items.length === 1 ? 'video' : 'videos'} · {formatDuration(totalDuration)}
            {collection.description && <span className="block mt-1">{collection.description}</span>}
          </>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => {
              setName(collection.name)
              setDescription(collection.description)
              setEditing(true)
            }}>
              Rename
            </Button>
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Add videos
            </Button>
            {items.length > 0 && (
              <>
                <Button variant="outline" onClick={() => launch(items, { source, shuffle: true })}>
                  <Shuffle className="size-4" aria-hidden="true" />
                  Shuffle
                </Button>
                <Button variant="primary" onClick={() => launch(items, { source })}>
                  <Play className="size-4 fill-current" aria-hidden="true" />
                  Play
                </Button>
              </>
            )}
          </>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" />}
          title="This collection is empty"
          description="Add videos from your library to build it up."
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add videos
            </Button>
          }
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
                    label={`Remove ${video.title} from collection`}
                    size="sm"
                    onClick={() => void removeFromCollection(collection.id, video.id)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </>
              }
            />
          ))}
        </div>
      )}

      <div className="mt-10 border-t border-line pt-6">
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" aria-hidden="true" />
          Delete collection
        </Button>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add videos" size="lg">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search your library…"
          aria-label="Search videos to add"
          className="mb-4 w-full rounded-xl border border-line bg-bg-deep px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-accent/60 focus:outline-none"
        />
        <div className="space-y-1">
          {candidates.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">No videos left to add.</p>
          )}
          {candidates.map((video) => (
            <VideoRow
              key={video.id}
              video={video}
              onPlay={() => void addToCollection(collection.id, [video.id])}
              right={
                <Button size="sm" onClick={() => void addToCollection(collection.id, [video.id])}>
                  Add
                </Button>
              }
            />
          ))}
        </div>
      </Modal>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit collection"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await updateCollection(collection.id, {
                  name: name.trim() || collection.name,
                  description: description.trim(),
                })
                setEditing(false)
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} data-autofocus />
          <TextArea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete “${collection.name}”?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteCollection(collection.id)
                navigate('/collections')
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">The videos themselves stay in your library.</p>
      </Modal>
    </>
  )
}
