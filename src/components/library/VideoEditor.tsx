import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SelectField, TextArea, TextField } from '@/components/ui/Field'
import { useLibrary } from '@/store/library'
import type { Video } from '@/types'
import { formatBytes, formatDuration, formatRelativeDate } from '@/utils/format'

interface Props {
  video: Video | null
  onClose: () => void
}

export function VideoEditor({ video, onClose }: Props) {
  const categories = useLibrary((s) => s.categories)
  const updateVideo = useLibrary((s) => s.updateVideo)
  const deleteVideo = useLibrary((s) => s.deleteVideo)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Other')
  const [tags, setTags] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!video) return
    setTitle(video.title)
    setDescription(video.description)
    setCategory(video.category)
    setTags(video.tags.join(', '))
    setConfirmDelete(false)
  }, [video])

  if (!video) return null

  const save = async () => {
    await updateVideo(video.id, {
      title: title.trim() || video.filename,
      description: description.trim(),
      category,
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean),
        ),
      ],
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit video"
      description={video.filename}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} data-autofocus />
        <TextArea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes about this video"
        />
        <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {[...new Set([...categories, video.category])].map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="python, tutorial, async"
          hint="Comma separated"
        />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4 text-xs text-muted sm:grid-cols-4">
          <div>
            <dt className="text-faint">Duration</dt>
            <dd className="tabular-nums">{formatDuration(video.duration)}</dd>
          </div>
          <div>
            <dt className="text-faint">Size</dt>
            <dd className="tabular-nums">{video.size ? formatBytes(video.size) : '—'}</dd>
          </div>
          <div>
            <dt className="text-faint">Added</dt>
            <dd>{formatRelativeDate(video.dateAdded)}</dd>
          </div>
          <div>
            <dt className="text-faint">Watched</dt>
            <dd>{video.lastWatched ? formatRelativeDate(video.lastWatched) : 'Never'}</dd>
          </div>
        </dl>

        <div className="border-t border-line pt-4">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">Delete this video and its file from storage?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    await deleteVideo(video.id)
                    onClose()
                  }}
                >
                  Delete permanently
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete video
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
