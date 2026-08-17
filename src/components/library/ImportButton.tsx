import { useEffect, useRef, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLibrary } from '@/store/library'
import { cn } from '@/utils/cn'

const ACCEPT = 'video/*,.mp4,.webm,.mov,.m4v,.ogv,.mkv'

interface Props {
  category?: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline'
}

export function ImportButton({ category, label = 'Add videos', size = 'md', variant = 'primary' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const importFiles = useLibrary((s) => s.importFiles)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          if (files.length) void importFiles(files, category)
        }}
      />
      <Button variant={variant} size={size} onClick={() => inputRef.current?.click()}>
        <Plus className="size-4" aria-hidden="true" />
        {label}
      </Button>
    </>
  )
}

/** Full-window drop target — active whenever files are dragged over the app. */
export function DropZone({ category }: { category?: string }) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const importFiles = useLibrary((s) => s.importFiles)

  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files')

    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth.current += 1
      setDragging(true)
    }
    const onOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const onLeave = () => {
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth.current = 0
      setDragging(false)
      const files = [...(event.dataTransfer?.files ?? [])]
      if (files.length) void importFiles(files, category)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [importFiles, category])

  if (!dragging) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/85 p-8 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col items-center rounded-3xl border-2 border-dashed border-accent/70 px-8 py-14 text-center">
        <Upload className="mb-4 size-8 text-accent" aria-hidden="true" />
        <p className="text-lg font-medium">Drop to add to your library</p>
        <p className="mt-1 text-sm text-muted">MP4, WebM, MOV and other browser-playable files</p>
      </div>
    </div>
  )
}

/** Inline progress strip shown while files are being probed and stored. */
export function ImportStatus() {
  const progress = useLibrary((s) => s.importProgress)
  if (!progress) return null

  const { total, done, current, failed } = progress
  const pct = total > 0 ? Math.round((done / total) * 100) : 100
  const finished = total > 0 && done >= total

  return (
    <div
      className="mb-6 rounded-card border border-line bg-surface px-4 py-3.5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="min-w-0 truncate">
          {finished ? `Added ${total} ${total === 1 ? 'video' : 'videos'}` : `Adding ${current}`}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-faint">
          {done}/{total}
        </span>
      </div>
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full bg-accent transition-[width] duration-300')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {failed.length > 0 && (
        <p className="mt-2.5 text-xs text-danger">
          Skipped {failed.length}: {failed.slice(0, 3).join(', ')}
          {failed.length > 3 && ` +${failed.length - 3} more`}
        </p>
      )}
    </div>
  )
}
