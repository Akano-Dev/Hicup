export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${rand}`
}

/** 0:42 · 12:05 · 1:03:22 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`
}

/** Long-form watch totals: "3h 12m", "48m", "35s". */
export function formatWatchTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 1) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${Math.floor(seconds)}s`
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

const DAY = 86_400_000

export function formatRelativeDate(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`

  const startOfToday = new Date().setHours(0, 0, 0, 0)
  if (timestamp >= startOfToday) return 'Today'
  if (timestamp >= startOfToday - DAY) return 'Yesterday'
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} days ago`
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(timestamp).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Strip extension and tidy separators into a readable default title. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^./\\]+$/, '')
  return (
    base
      .replace(/[_.]+/g, ' ')
      .replace(/-+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || filename
  )
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
