export interface ProbeResult {
  duration: number
  width: number
  height: number
  thumbnail?: string
}

const THUMB_MAX = 480
const TIMEOUT_MS = 15_000

/**
 * Read duration/dimensions from a media file and grab a poster frame.
 * Everything happens in the browser — no upload, no external service.
 */
export function probeVideo(source: Blob | string): Promise<ProbeResult> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  const revoke = () => {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }

  return new Promise<ProbeResult>((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    let settled = false

    const finish = (result: ProbeResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      revoke()
      resolve(result)
    }

    const timer = setTimeout(
      () => finish({ duration: 0, width: 0, height: 0 }),
      TIMEOUT_MS,
    )

    const capture = () => {
      const width = video.videoWidth
      const height = video.videoHeight
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      try {
        const scale = Math.min(1, THUMB_MAX / Math.max(width || 1, height || 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx || !width || !height) return finish({ duration, width, height })
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish({ duration, width, height, thumbnail: canvas.toDataURL('image/jpeg', 0.72) })
      } catch {
        // Tainted canvas (cross-origin demo clip) or no 2d context — metadata still useful.
        finish({ duration, width, height })
      }
    }

    video.addEventListener('loadedmetadata', () => {
      const target = Math.min(1, (video.duration || 2) * 0.25)
      if (!Number.isFinite(video.duration) || video.duration === 0) return capture()
      video.currentTime = target
    })
    video.addEventListener('seeked', capture, { once: true })
    video.addEventListener('error', () => finish({ duration: 0, width: 0, height: 0 }))

    video.src = url
  })
}

const ACCEPTED = /^video\//
const ACCEPTED_EXT = /\.(mp4|webm|mov|m4v|ogv|ogg|mkv|avi)$/i

export function isVideoFile(file: File): boolean {
  return ACCEPTED.test(file.type) || ACCEPTED_EXT.test(file.name)
}

/** The browser can only play what it can decode; warn rather than fail silently. */
export function isLikelyPlayable(mimeType: string, filename: string): boolean {
  if (typeof document === 'undefined') return true
  const probe = document.createElement('video')
  if (mimeType && probe.canPlayType(mimeType)) return true
  if (/\.(mp4|m4v|mov)$/i.test(filename)) return !!probe.canPlayType('video/mp4')
  if (/\.webm$/i.test(filename)) return !!probe.canPlayType('video/webm')
  if (/\.(ogv|ogg)$/i.test(filename)) return !!probe.canPlayType('video/ogg')
  return false
}
