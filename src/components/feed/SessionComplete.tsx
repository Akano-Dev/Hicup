import type { WatchSession } from '@/types'
import { formatWatchTime } from '@/utils/format'
import { Button } from '@/components/ui/Button'

interface Props {
  session: WatchSession
  onAnother: () => void
  onEnd: () => void
}

/** Calm, factual close-out — no streaks, scores or nudges to continue. */
export function SessionComplete({ session, onAnother, onEnd }: Props) {
  const count = session.videosWatched.length
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/95 px-6 backdrop-blur-xl">
      <div className="w-full max-w-sm animate-rise text-center">
        <div className="mx-auto mb-7 h-px w-12 bg-accent" />
        <h1 className="text-2xl font-semibold">Session complete</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          You watched for {formatWatchTime(session.elapsedSeconds)}
          {count > 0 && (
            <>
              {' · '}
              {count} {count === 1 ? 'video' : 'videos'}
            </>
          )}
          .
        </p>

        <div className="mt-9 flex flex-col gap-2.5">
          <Button variant="primary" size="lg" onClick={onEnd}>
            End session
          </Button>
          <Button variant="ghost" onClick={onAnother}>
            Start another session
          </Button>
        </div>
      </div>
    </div>
  )
}
