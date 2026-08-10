import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BarberPole } from './BarberPole'
import { SetupBanner } from './SetupBanner'
import { getSegmentFromPath } from '../lib/segments'

export function PublicLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const segment = getSegmentFromPath(pathname)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SetupBanner />
      <header className="border-b border-paper-dark bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="font-display text-3xl tracking-wider text-ink">
              FIND
            </Link>
            {segment && (
              <span className="hidden text-xs uppercase tracking-widest text-brass sm:inline">
                {segment.brandName.replace('FIND ', '')}
              </span>
            )}
          </div>
          <nav className="flex items-center gap-4 text-sm">
            {!isHome && (
              <Link to="/" className="text-ink-muted hover:text-brass transition-colors">
                Soluções
              </Link>
            )}
            {user ? (
              <Link to="/minhas-reservas" className="text-ink-muted hover:text-brass transition-colors">
                Minhas Reservas
              </Link>
            ) : (
              <Link to="/entrar" className="text-ink-muted hover:text-brass transition-colors">
                Entrar
              </Link>
            )}
            <Link
              to="/painel"
              className="rounded border border-ink/20 px-3 py-1.5 text-ink-muted hover:border-brass hover:text-brass transition-colors"
            >
              Área profissional
            </Link>
          </nav>
        </div>
        <BarberPole height="h-1.5" />
      </header>
      <main className={`mx-auto px-4 py-8 ${isHome ? 'max-w-4xl' : 'max-w-5xl'}`}>
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-paper-dark py-6 text-center text-sm text-ink-muted">
        <BarberPole className="mb-4 max-w-xs mx-auto" />
        <p>FIND — uma plataforma, várias soluções</p>
      </footer>
    </div>
  )
}
