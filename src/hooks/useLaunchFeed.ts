import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { shuffled } from '@/services/library'
import { useFeed } from '@/store/feed'
import type { SessionSource, Video } from '@/types'

export interface LaunchOptions {
  source: SessionSource
  startId?: string
  shuffle?: boolean
}

/** Single entry point for "start playing these videos" from anywhere in the app. */
export function useLaunchFeed() {
  const navigate = useNavigate()
  const setPlaylist = useFeed((s) => s.setPlaylist)

  return useCallback(
    (videos: Video[] | string[], { source, startId, shuffle = false }: LaunchOptions) => {
      const ids = videos.map((v) => (typeof v === 'string' ? v : v.id))
      if (!ids.length) return false
      // A chosen starting video always leads, even in shuffle.
      const ordered = shuffle
        ? startId
          ? [startId, ...shuffled(ids.filter((id) => id !== startId))]
          : shuffled(ids)
        : ids
      setPlaylist({ playlist: ordered, source, shuffle, startId })
      navigate('/feed')
      return true
    },
    [navigate, setPlaylist],
  )
}
