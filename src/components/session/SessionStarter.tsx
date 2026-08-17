import { useMemo, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Chip } from '@/components/ui/Layout'
import { useLaunchFeed } from '@/hooks/useLaunchFeed'
import { categoryCounts } from '@/services/library'
import { useLibrary } from '@/store/library'
import { useQueue } from '@/store/queue'
import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'
import type { SessionSource, Video } from '@/types'
import { cn } from '@/utils/cn'

const DURATIONS = [15, 30, 45, 60]

interface Props {
  open: boolean
  onClose: () => void
}

type SourceChoice = { kind: SessionSource['kind']; value?: string; label: string }

export function SessionStarter({ open, onClose }: Props) {
  const videos = useLibrary((s) => s.videos)
  const collections = useLibrary((s) => s.collections)
  const queueIds = useQueue((s) => s.ids)
  const defaultMinutes = useSettings((s) => s.defaultSessionMinutes)
  const startSession = useSession((s) => s.start)
  const launch = useLaunchFeed()

  const [minutes, setMinutes] = useState<number>(defaultMinutes)
  const [custom, setCustom] = useState('')
  const [untimed, setUntimed] = useState(false)
  const [shuffle, setShuffle] = useState(true)
  const [choice, setChoice] = useState<SourceChoice>({ kind: 'all', label: 'All videos' })

  const counts = useMemo(() => categoryCounts(videos), [videos])
  const favorites = useMemo(() => videos.filter((v) => v.favorite), [videos])

  const selected: Video[] = useMemo(() => {
    switch (choice.kind) {
      case 'favorites':
        return favorites
      case 'queue':
        return queueIds.map((id) => videos.find((v) => v.id === id)).filter((v) => v !== undefined)
      case 'category':
        return videos.filter((v) => v.category === choice.value)
      case 'collection': {
        const collection = collections.find((c) => c.id === choice.value)
        if (!collection) return []
        return collection.videoIds
          .map((id) => videos.find((v) => v.id === id))
          .filter((v) => v !== undefined)
      }
      default:
        return videos
    }
  }, [choice, videos, favorites, queueIds, collections])

  const start = () => {
    if (!selected.length) return
    const plannedSeconds = untimed ? 0 : Math.max(1, minutes) * 60
    const source: SessionSource = { kind: choice.kind, value: choice.value, label: choice.label }
    startSession({ plannedSeconds, source, shuffle, videoIds: selected.map((v) => v.id) })
    launch(selected, { source, shuffle })
    onClose()
  }

  const sourceOptions: SourceChoice[] = [
    { kind: 'all', label: 'All videos' },
    ...(favorites.length ? [{ kind: 'favorites' as const, label: 'Favorites' }] : []),
    ...(queueIds.length ? [{ kind: 'queue' as const, label: 'Queue' }] : []),
    ...collections.map((c) => ({ kind: 'collection' as const, value: c.id, label: c.name })),
    ...[...counts.keys()]
      .sort()
      .map((name) => ({ kind: 'category' as const, value: name, label: name })),
  ]

  const isSelected = (option: SourceChoice) =>
    option.kind === choice.kind && option.value === choice.value

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a watch session"
      description="Decide up front how long you want to watch."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={start} disabled={!selected.length}>
            {selected.length ? `Start · ${selected.length} videos` : 'Nothing to play'}
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-faint">Duration</h3>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((value) => (
              <Chip
                key={value}
                active={!untimed && minutes === value && !custom}
                onClick={() => {
                  setMinutes(value)
                  setCustom('')
                  setUntimed(false)
                }}
              >
                {value} min
              </Chip>
            ))}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
                custom && !untimed ? 'border-accent text-text' : 'border-line text-muted',
              )}
            >
              <input
                type="number"
                min={1}
                max={480}
                value={custom}
                onChange={(event) => {
                  setCustom(event.target.value)
                  setUntimed(false)
                  const parsed = Number(event.target.value)
                  if (parsed > 0) setMinutes(parsed)
                }}
                placeholder="Custom"
                aria-label="Custom session length in minutes"
                className="w-16 bg-transparent text-sm focus:outline-none"
              />
              min
            </div>
            <Chip active={untimed} onClick={() => setUntimed(true)}>
              No limit
            </Chip>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-faint">Watch from</h3>
          <div className="flex flex-wrap gap-2">
            {sourceOptions.map((option) => (
              <Chip
                key={`${option.kind}:${option.value ?? ''}`}
                active={isSelected(option)}
                onClick={() => setChoice(option)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShuffle(!shuffle)}
          aria-pressed={shuffle}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
            shuffle ? 'border-accent/60 bg-accent-soft' : 'border-line hover:bg-surface-2',
          )}
        >
          <Shuffle className={cn('size-4', shuffle ? 'text-accent' : 'text-faint')} aria-hidden="true" />
          <span className="flex-1 text-sm">
            <span className="block font-medium">Shuffle</span>
            <span className="text-xs text-muted">Random order from your own selection only</span>
          </span>
        </button>
      </div>
    </Modal>
  )
}
