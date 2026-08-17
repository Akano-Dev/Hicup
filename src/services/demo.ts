import { storage } from '@/services/storage/indexedDb'
import type { Video } from '@/types'
import { uid } from '@/utils/format'

/**
 * Demo clips are generated on this device with canvas + MediaRecorder — no
 * external assets, no network, nothing scraped. They are tagged `demo: true`
 * so they can be removed in one action once real videos arrive.
 */
interface DemoSpec {
  title: string
  description: string
  category: string
  tags: string[]
  colors: [string, string]
  seconds: number
}

const SPECS: DemoSpec[] = [
  {
    title: 'Sample · Aurora',
    description: 'A generated demo clip so you can try the feed before adding your own videos.',
    category: 'Inspiration',
    tags: ['demo', 'ambient'],
    colors: ['#0f172a', '#22d3ee'],
    seconds: 5,
  },
  {
    title: 'Sample · Ember',
    description: 'Scroll down to see how the next video takes over automatically.',
    category: 'Personal',
    tags: ['demo', 'warm'],
    colors: ['#1c1917', '#f59e0b'],
    seconds: 5,
  },
  {
    title: 'Sample · Tide',
    description: 'Playback position, favorites and history all work on demo clips too.',
    category: 'Learning',
    tags: ['demo', 'calm'],
    colors: ['#111827', '#818cf8'],
    seconds: 5,
  },
]

export function canGenerateDemo(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  )
}

function pickMimeType(): string | undefined {
  for (const type of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return undefined
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  spec: DemoSpec,
  progress: number,
  size: { w: number; h: number },
) {
  const { w, h } = size
  const t = progress * Math.PI * 2

  const gradient = ctx.createLinearGradient(0, h * (0.2 + 0.2 * Math.sin(t)), w, h)
  gradient.addColorStop(0, spec.colors[0])
  gradient.addColorStop(1, spec.colors[1])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  ctx.globalAlpha = 0.28
  for (let i = 0; i < 4; i++) {
    const phase = t + (i * Math.PI) / 2
    ctx.beginPath()
    ctx.arc(
      w * (0.5 + 0.32 * Math.sin(phase)),
      h * (0.5 + 0.22 * Math.cos(phase * 0.7)),
      w * (0.22 + 0.05 * Math.sin(phase * 1.3)),
      0,
      Math.PI * 2,
    )
    ctx.fillStyle = i % 2 ? spec.colors[1] : '#ffffff'
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = `600 ${Math.round(w * 0.075)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(spec.title.replace('Sample · ', ''), w / 2, h * 0.52)
  ctx.font = `400 ${Math.round(w * 0.036)}px system-ui, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('Hicup demo clip', w / 2, h * 0.58)
}

async function recordClip(spec: DemoSpec): Promise<{ blob: Blob; thumbnail: string } | null> {
  const canvas = document.createElement('canvas')
  canvas.width = 540
  canvas.height = 960
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const mimeType = pickMimeType()
  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data)

  const size = { w: canvas.width, h: canvas.height }
  const started = performance.now()
  let raf = 0
  const loop = () => {
    const elapsed = (performance.now() - started) / 1000
    drawFrame(ctx, spec, (elapsed / spec.seconds) % 1, size)
    raf = requestAnimationFrame(loop)
  }

  drawFrame(ctx, spec, 0.25, size)
  const thumbnail = canvas.toDataURL('image/jpeg', 0.7)

  return new Promise((resolve) => {
    recorder.onstop = () => {
      cancelAnimationFrame(raf)
      for (const track of stream.getTracks()) track.stop()
      resolve({ blob: new Blob(chunks, { type: mimeType ?? 'video/webm' }), thumbnail })
    }
    recorder.start()
    loop()
    setTimeout(() => recorder.stop(), spec.seconds * 1000)
  })
}

export async function generateDemoLibrary(
  onProgress?: (done: number, total: number) => void,
): Promise<Video[]> {
  const created: Video[] = []
  for (const [index, spec] of SPECS.entries()) {
    onProgress?.(index, SPECS.length)
    const clip = await recordClip(spec)
    if (!clip) continue
    const video: Video = {
      id: uid('demo_'),
      title: spec.title,
      description: spec.description,
      filename: `${spec.title.toLowerCase().replace(/[^a-z]+/g, '-')}.webm`,
      mimeType: clip.blob.type || 'video/webm',
      size: clip.blob.size,
      sourceKind: 'blob',
      thumbnail: clip.thumbnail,
      duration: spec.seconds,
      category: spec.category,
      tags: spec.tags,
      dateAdded: Date.now(),
      watchProgress: 0,
      completed: false,
      favorite: false,
      playCount: 0,
      demo: true,
    }
    await storage.putMedia(video.id, clip.blob)
    await storage.putVideo(video)
    created.push(video)
  }
  onProgress?.(SPECS.length, SPECS.length)
  return created
}
