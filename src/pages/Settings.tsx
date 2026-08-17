import { useEffect, useRef, useState } from 'react'
import { Check, Download, Plus, Upload, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { SelectField, Toggle } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/Layout'
import { storage } from '@/services/storage/indexedDb'
import { buildExport, downloadJson, parseImport } from '@/services/transfer'
import { useLibrary } from '@/store/library'
import { getSettings, useSettings } from '@/store/settings'
import { useQueue } from '@/store/queue'
import { useSession } from '@/store/session'
import type { AccentName, PreloadMode, ThemeMode } from '@/types'
import { formatBytes } from '@/utils/format'
import { cn } from '@/utils/cn'

const ACCENTS: Array<{ value: AccentName; label: string; swatch: string }> = [
  { value: 'amber', label: 'Amber', swatch: 'oklch(0.79 0.15 78)' },
  { value: 'iris', label: 'Iris', swatch: 'oklch(0.68 0.18 285)' },
  { value: 'mint', label: 'Mint', swatch: 'oklch(0.8 0.14 168)' },
  { value: 'rose', label: 'Rose', swatch: 'oklch(0.71 0.18 15)' },
  { value: 'ice', label: 'Ice', swatch: 'oklch(0.79 0.13 225)' },
]

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-card border border-line/70 bg-surface p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4 divide-y divide-line/60">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const settings = useSettings()
  const setSetting = settings.set
  const videos = useLibrary((s) => s.videos)
  const collections = useLibrary((s) => s.collections)
  const history = useLibrary((s) => s.history)
  const sessions = useLibrary((s) => s.sessions)
  const categories = useLibrary((s) => s.categories)
  const addCategory = useLibrary((s) => s.addCategory)
  const removeCategory = useLibrary((s) => s.removeCategory)
  const clearHistory = useLibrary((s) => s.clearHistory)
  const deleteVideos = useLibrary((s) => s.deleteVideos)
  const resetAll = useLibrary((s) => s.resetAll)
  const replaceState = useLibrary((s) => s.replaceState)
  const clearQueue = useQueue((s) => s.clear)
  const endSession = useSession((s) => s.end)

  const fileRef = useRef<HTMLInputElement>(null)
  const [newCategory, setNewCategory] = useState('')
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void storage.estimateUsage().then(setUsage)
  }, [videos.length])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [message])

  const demoCount = videos.filter((v) => v.demo).length

  const exportLibrary = (includeThumbnails: boolean) => {
    downloadJson(
      buildExport({ videos, collections, history, sessions, settings: getSettings(), includeThumbnails }),
      `hicup-library-${new Date().toISOString().slice(0, 10)}.json`,
    )
    setMessage('Library metadata exported.')
  }

  const importLibrary = async (file: File) => {
    try {
      const parsed = parseImport(await file.text())
      await replaceState({
        videos: parsed.videos,
        collections: parsed.collections,
        history: parsed.history,
        sessions: parsed.sessions,
      })
      if (Object.keys(parsed.settings).length) settings.replaceAll(parsed.settings)
      setMessage(`Imported ${parsed.videos.length} videos and ${parsed.collections.length} collections.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Everything here applies to this browser only." />

      {message && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm"
        >
          {message}
        </p>
      )}

      <Group title="Playback">
        <Toggle
          label="Autoplay"
          description="Start the active video automatically as you scroll."
          checked={settings.autoplay}
          onChange={(value) => setSetting('autoplay', value)}
        />
        <Toggle
          label="Resume playback"
          description="Pick up where you left off instead of starting from the beginning."
          checked={settings.resumePlayback}
          onChange={(value) => setSetting('resumePlayback', value)}
        />
        <Toggle
          label="Auto-scroll"
          description="Move to the next video automatically when one finishes, and stop at the end of the list."
          checked={settings.autoAdvance}
          onChange={(value) => setSetting('autoAdvance', value)}
        />
        <Toggle
          label="Loop videos"
          description={
            settings.autoAdvance
              ? 'Overridden while auto-scroll is on — a looping video never finishes.'
              : 'Repeat the active video until you scroll on.'
          }
          checked={settings.loop}
          onChange={(value) => setSetting('loop', value)}
        />
        <Toggle
          label="Start muted"
          description="Browsers require muted playback until you interact with the page."
          checked={settings.muted}
          onChange={(value) => setSetting('muted', value)}
        />
        <div className="py-4">
          <label htmlFor="volume" className="flex items-center justify-between text-sm font-medium">
            Default volume
            <span className="tabular-nums text-muted">{Math.round(settings.volume * 100)}%</span>
          </label>
          <input
            id="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(event) => setSetting('volume', Number(event.target.value))}
            className="mt-3 w-full accent-[var(--c-accent)]"
          />
        </div>
        <div className="py-4">
          <SelectField
            label="Preload nearby videos"
            hint="Lower settings use less memory and bandwidth on large libraries."
            value={settings.preload}
            onChange={(event) => setSetting('preload', event.target.value as PreloadMode)}
          >
            <option value="none">None</option>
            <option value="metadata">Metadata only</option>
            <option value="auto">Full preload</option>
          </SelectField>
        </div>
      </Group>

      <Group title="Appearance">
        <div className="py-4">
          <SelectField
            label="Theme"
            value={settings.theme}
            onChange={(event) => setSetting('theme', event.target.value as ThemeMode)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">Match system</option>
          </SelectField>
        </div>
        <div className="py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-faint">Accent</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((accent) => (
              <button
                key={accent.value}
                type="button"
                onClick={() => setSetting('accent', accent.value)}
                aria-pressed={settings.accent === accent.value}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
                  settings.accent === accent.value ? 'border-accent text-text' : 'border-line text-muted',
                )}
              >
                <span className="size-3.5 rounded-full" style={{ background: accent.swatch }} />
                {accent.label}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          label="Reduce motion"
          description="Turn off transitions and smooth scrolling."
          checked={settings.reducedMotion}
          onChange={(value) => setSetting('reducedMotion', value)}
        />
      </Group>

      <Group title="Watch sessions" description="Decide up front how long you want to watch.">
        <div className="py-4">
          <SelectField
            label="Default session length"
            value={String(settings.defaultSessionMinutes)}
            onChange={(event) => setSetting('defaultSessionMinutes', Number(event.target.value))}
          >
            {[15, 30, 45, 60, 90].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </SelectField>
        </div>
        <Toggle
          label="Show session timer"
          description="A quiet countdown in the corner of the feed."
          checked={settings.showSessionTimer}
          onChange={(value) => setSetting('showSessionTimer', value)}
        />
        <Toggle
          label="Show completion screen"
          description="A calm summary when the session ends."
          checked={settings.showCompletionScreen}
          onChange={(value) => setSetting('showCompletionScreen', value)}
        />
      </Group>

      <Group title="Categories" description="Used to organise and filter your library.">
        <div className="flex flex-wrap gap-2 py-4">
          {categories.map((category) => (
            <span
              key={category}
              className="flex items-center gap-1.5 rounded-full border border-line py-1 pl-3 pr-1.5 text-sm text-muted"
            >
              {category}
              <IconButton
                label={`Remove ${category}`}
                size="sm"
                className="size-6"
                onClick={() => void removeCategory(category)}
              >
                <X className="size-3.5" />
              </IconButton>
            </span>
          ))}
        </div>
        <form
          className="flex gap-2 py-4"
          onSubmit={(event) => {
            event.preventDefault()
            void addCategory(newCategory)
            setNewCategory('')
          }}
        >
          <input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="New category"
            aria-label="New category name"
            className="flex-1 rounded-xl border border-line bg-bg-deep px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-accent/60 focus:outline-none"
          />
          <Button type="submit" disabled={!newCategory.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        </form>
      </Group>

      <Group
        title="Data"
        description={
          usage
            ? `${videos.length} videos · ${formatBytes(usage.usage)} used${usage.quota ? ` of ${formatBytes(usage.quota)} available` : ''}`
            : `${videos.length} videos stored locally`
        }
      >
        <div className="flex flex-wrap gap-2 py-4">
          <Button onClick={() => exportLibrary(true)}>
            <Download className="size-4" aria-hidden="true" />
            Export metadata
          </Button>
          <Button variant="ghost" onClick={() => exportLibrary(false)}>
            Export without thumbnails
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void importLibrary(file)
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            Import metadata
          </Button>
        </div>
        <p className="pb-4 text-xs text-faint">
          Exports describe your library — titles, tags, collections, history and settings. Video files
          themselves stay on this device.
        </p>

        <div className="flex flex-wrap gap-2 py-4">
          <Button variant="danger" size="sm" onClick={() => void clearHistory()}>
            Clear watch history
          </Button>
          <Button variant="danger" size="sm" onClick={clearQueue}>
            Clear queue
          </Button>
          {demoCount > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void deleteVideos(videos.filter((v) => v.demo).map((v) => v.id))}
            >
              Remove {demoCount} demo clips
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
            Reset everything
          </Button>
        </div>
      </Group>

      <p className="pb-4 text-center text-xs text-faint">
        Hicup keeps your videos, history and settings on this device. No accounts, no uploads, no
        recommendations.
      </p>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all application data?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                endSession()
                clearQueue()
                await resetAll()
                settings.reset()
                setConfirmReset(false)
                setMessage('All local data was removed.')
              }}
            >
              <Check className="size-4" aria-hidden="true" />
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          This deletes every stored video file, all metadata, history, collections and settings from
          this browser. It can’t be undone.
        </p>
      </Modal>
    </div>
  )
}
