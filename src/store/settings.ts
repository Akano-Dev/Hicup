import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS, type Settings } from '@/types'

interface SettingsState extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  replaceAll: (settings: Partial<Settings>) => void
  reset: () => void
}

/**
 * Settings are small and needed synchronously on first paint, so they live in
 * localStorage rather than IndexedDB.
 */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      replaceAll: (settings) => set({ ...DEFAULT_SETTINGS, ...settings }),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    { name: 'hicup.settings', version: 1 },
  ),
)

export function getSettings(): Settings {
  const { set: _set, replaceAll: _replaceAll, reset: _reset, ...rest } = useSettings.getState()
  return rest
}

/** Apply theme/accent/motion to the document root. */
export function applyAppearance(settings: Pick<Settings, 'theme' | 'accent' | 'reducedMotion'>) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolved =
    settings.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : settings.theme
  root.dataset.theme = resolved
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.accent = settings.accent
  if (settings.reducedMotion) root.dataset.motion = 'reduced'
  else delete root.dataset.motion
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#08080a' : '#f7f7f8')
}
