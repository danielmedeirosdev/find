import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BrandLogo } from './BrandLogo'

export function InternalAdminLayout() {
  const { user, loading } = useAuth()
  if (loading) return <main className="min-h-screen bg-charcoal p-8 text-white">Carregando...</main>
  if (!user) return <Navigate to="/painel" replace />
  if (user.app_metadata?.onefind_platform_admin !== true) return <Navigate to="/painel/dashboard" replace />

  return <div className="min-h-screen bg-[#151515] text-white">
    <header className="border-b border-white/10 px-5 py-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4"><Link to="/interno"><BrandLogo inverse /></Link><span className="border-l border-white/20 pl-4 text-xs text-neutral-400">Administração</span></div>
        <nav aria-label="Navegação administrativa" className="flex gap-2">
          <NavLink end to="/interno" className={({isActive})=>isActive?'rounded-lg bg-white/10 px-3 py-2 text-sm text-brass':'rounded-lg px-3 py-2 text-sm text-neutral-300'}>Visão geral</NavLink>
          <NavLink to="/interno/nova" className={({isActive})=>isActive?'rounded-lg bg-white/10 px-3 py-2 text-sm text-brass':'rounded-lg px-3 py-2 text-sm text-neutral-300'}>Nova loja</NavLink>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><Outlet /></main>
  </div>
}
