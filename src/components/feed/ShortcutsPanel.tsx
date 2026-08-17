import { Modal } from '@/components/ui/Modal'

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Play / pause'],
  ['↑', 'Previous video'],
  ['↓', 'Next video'],
  ['← / →', 'Seek 5 seconds'],
  ['M', 'Mute / unmute'],
  ['F', 'Fullscreen'],
  ['L', 'Favorite'],
  ['Q', 'Add to queue'],
  ['S', 'Shuffle remaining'],
  ['?', 'This panel'],
  ['Esc', 'Exit fullscreen / leave feed'],
]

export function ShortcutsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <dl className="divide-y divide-line/70">
        {SHORTCUTS.map(([key, description]) => (
          <div key={key} className="flex items-center justify-between gap-6 py-2.5">
            <dt className="text-sm text-muted">{description}</dt>
            <dd>
              <kbd className="rounded-md border border-line bg-bg-deep px-2 py-1 text-xs font-medium text-text">
                {key}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}
