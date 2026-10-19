import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BrandLogo } from './BrandLogo'

export function InternalAdminLayout() {
  const { user, loading } = useAuth()
  if (loading) return <main className="min-h-screen bg-charcoal p-8 text-white">Carregando...</main>
  if (!user) return <Navigate to="/painel" replace />
  if (user.app_metadata?.onefind_platform_admin !== true) return <Navigate to="/painel/dashboard" replace />

  return <div className="min-h-screen bg-charcoal text-white">
    <header className="border-b border-charcoal-light px-6 py-5">
      <BrandLogo inverse />
      <span className="ml-4 text-sm text-charcoal-muted">Área interna</span>
    </header>
    <main className="mx-auto max-w-5xl p-6"><Outlet /></main>
  </div>
}
