import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Logo } from '@/components/Logo'
import { useLibrary } from '@/store/library'
import { applyAppearance, useSettings } from '@/store/settings'
import { CollectionDetailPage } from '@/pages/CollectionDetail'
import { CollectionsPage } from '@/pages/Collections'
import { FavoritesPage } from '@/pages/Favorites'
import { FeedPage } from '@/pages/Feed'
import { HistoryPage } from '@/pages/History'
import { HomePage } from '@/pages/Home'
import { LibraryPage } from '@/pages/Library'
import { QueuePage } from '@/pages/Queue'
import { SettingsPage } from '@/pages/Settings'

function useAppearance() {
  const theme = useSettings((s) => s.theme)
  const accent = useSettings((s) => s.accent)
  const reducedMotion = useSettings((s) => s.reducedMotion)

  useEffect(() => {
    applyAppearance({ theme, accent, reducedMotion })
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyAppearance({ theme, accent, reducedMotion })
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme, accent, reducedMotion])
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <Logo className="size-10 animate-pulse" />
      <span className="sr-only">Loading your library</span>
    </div>
  )
}

export function App() {
  const ready = useLibrary((s) => s.ready)
  const load = useLibrary((s) => s.load)
  useAppearance()

  useEffect(() => {
    void load()
  }, [load])

  if (!ready) return <Splash />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/feed" element={<FeedPage />} />
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/:id" element={<CollectionDetailPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="queue" element={<QueuePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
