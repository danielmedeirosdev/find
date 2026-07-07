import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BarberPole } from './BarberPole'
import { SetupBanner } from './SetupBanner'

export function DashboardLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/painel')
  }

  return (
    <div className="min-h-screen bg-charcoal text-white">
      <SetupBanner />
      <header className="border-b border-charcoal-light bg-charcoal">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/painel" className="font-display text-3xl tracking-wider text-brass">
            FIND
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-charcoal-muted hover:text-brass transition-colors">
              Ver site público
            </Link>
            <button
              onClick={handleSignOut}
              className="text-charcoal-muted hover:text-white transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
        <BarberPole height="h-1.5" />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
