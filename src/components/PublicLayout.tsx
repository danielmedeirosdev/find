import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BarberPole } from './BarberPole'
import { SetupBanner } from './SetupBanner'

export function PublicLayout() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SetupBanner />
      <header className="border-b border-paper-dark bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-3xl tracking-wider text-ink">
            FIND
          </Link>
          <nav className="flex items-center gap-4 text-sm">
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
              Área do barbeiro
            </Link>
          </nav>
        </div>
        <BarberPole height="h-1.5" />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-paper-dark py-6 text-center text-sm text-ink-muted">
        <BarberPole className="mb-4 max-w-xs mx-auto" />
        <p>FIND — Agende sua barbearia com estilo</p>
      </footer>
    </div>
  )
}
