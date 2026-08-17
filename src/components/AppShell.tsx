import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Clock,
  Heart,
  Home,
  Layers,
  ListVideo,
  Search,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react'
import { useQueue } from '@/store/queue'
import { cn } from '@/utils/cn'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/library', label: 'Library', icon: ListVideo },
  { to: '/favorites', label: 'Favorites', icon: Heart },
  { to: '/collections', label: 'Collections', icon: Layers },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/queue', label: 'Queue', icon: Sparkles },
]

/** Nav items shown in the compact mobile bar. */
const MOBILE_NAV = NAV.filter((item) =>
  ['/', '/library', '/favorites', '/collections'].includes(item.to),
)

export function AppShell() {
  const navigate = useNavigate()
  const queueCount = useQueue((s) => s.ids.length)

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="sticky top-0 z-30 glass border-b border-line/70 pad-safe-t">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5" aria-label="Hicup home">
            <Logo className="size-7" />
            <span className="text-[15px] font-semibold tracking-tight">Hicup</span>
          </NavLink>

          <button
            type="button"
            onClick={() => navigate('/library?focus=search')}
            className="ml-auto flex h-9 items-center gap-2 rounded-full border border-line px-3.5 text-sm text-faint transition hover:border-faint hover:text-muted sm:w-64 md:w-80"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Search your library</span>
            <span className="sr-only sm:hidden">Search your library</span>
          </button>

          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              cn(
                'flex size-9 items-center justify-center rounded-full transition',
                isActive ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
              )
            }
          >
            <SettingsIcon className="size-5" />
          </NavLink>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <nav
          aria-label="Primary"
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col gap-1 border-r border-line/70 px-3 py-6 lg:flex"
        >
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition duration-200',
                  isActive
                    ? 'bg-surface-2 font-medium text-text'
                    : 'text-muted hover:bg-surface/70 hover:text-text',
                )
              }
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {to === '/queue' && queueCount > 0 && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-on-accent tabular-nums">
                  {queueCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-16">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Primary"
        className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line/70 pad-safe-b lg:hidden"
      >
        <div className="flex items-stretch justify-around">
          {MOBILE_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-w-16 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition',
                  isActive ? 'text-accent' : 'text-faint',
                )
              }
            >
              <Icon className="size-[22px]" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/queue"
            className={({ isActive }) =>
              cn(
                'relative flex min-w-16 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition',
                isActive ? 'text-accent' : 'text-faint',
              )
            }
          >
            <Sparkles className="size-[22px]" aria-hidden="true" />
            Queue
            {queueCount > 0 && (
              <span className="absolute right-3 top-1.5 size-2 rounded-full bg-accent" />
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
