import { useEffect, useRef, useState } from 'react'
import { storage } from '@/services/storage/indexedDb'
import type { Video } from '@/types'

/**
 * Resolve a playable URL for a video, but only while it is inside the feed
 * window — object URLs are released as soon as the slide falls out of range.
 */
export function useMediaUrl(video: Video | undefined, enabled: boolean) {
  const [url, setUrl] = useState<string | undefined>(
    video?.sourceKind === 'url' ? video.sourceUrl : undefined,
  )
  const [missing, setMissing] = useState(false)

  const videoRef = useRef(video)
  videoRef.current = video

  // Keyed on the id, not the object: the store replaces the video object on
  // every progress save, and re-resolving then would thrash storage.
  useEffect(() => {
    const current = videoRef.current
    if (!current || !enabled) return
    let cancelled = false
    setMissing(false)
    void storage.resolveMediaUrl(current).then((resolved) => {
      if (cancelled) return
      setUrl(resolved)
      setMissing(!resolved)
    })
    return () => {
      cancelled = true
    }
  }, [video?.id, enabled])

  return { url: enabled ? url : undefined, missing }
}
