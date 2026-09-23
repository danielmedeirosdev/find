import { DashboardHeaderContext } from '../contexts/DashboardHeaderContext'
import { AppIcon } from './AppIcon'
import { BrandLogo } from './BrandLogo'
import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BrandAccent } from './BrandAccent'
import { SetupBanner } from './SetupBanner'
import { getSegment, normalizeSegment, parseSegmentParam } from '../lib/segments'
import { supabase } from '../lib/supabase'
import type { ShopSegment } from '../lib/types'

export function DashboardLayout() {
  const [accountTarget, setAccountTarget] = useState<HTMLDivElement | null>(null)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const segmentParam = parseSegmentParam(params.get('segment'))
  const [shopSegment, setShopSegment] = useState<ShopSegment | null>(null)

  useEffect(() => {
    if (!user) {
      setShopSegment(null)
      return
    }
    let cancelled = false
    supabase
      .from('shops')
      .select('segment')
      .eq('owner_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const fromShop = data?.segment != null ? normalizeSegment(data.segment) : null
        const fromMeta = normalizeSegment(
          (user.user_metadata as { segment?: string } | undefined)?.segment
        )
        // Prioriza o segmento da loja; metadata só como fallback (ex.: cadastro PET).
        setShopSegment(fromShop ?? (fromMeta === 'pet' ? 'pet' : null))
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Nunca assume barbearia enquanto o segmento real não for conhecido —
  // isso evitava a faixa de barbearia no painel PET.
  const segmentId: ShopSegment | 'platform' =
    segmentParam || shopSegment || 'platform'
  const meta = getSegment(segmentId === 'platform' ? 'barbershop' : segmentId)
  const showSegmentMark = Boolean(segmentParam || shopSegment)
  const themeClass =
    segmentId === 'pet'
      ? 'segment-pet'
      : segmentId === 'barbershop'
        ? 'segment-barbershop'
        : ''

  const handleSignOut = async () => {
    await signOut()
    navigate('/painel')
  }

  return (
    <div
      className={`premium-dashboard min-h-screen bg-charcoal text-white ${themeClass}`}
      data-segment={segmentId === 'platform' ? undefined : segmentId}
    >
      <SetupBanner />
      <header className="dashboard-glass-header border-b border-charcoal-light">
        <div className="dashboard-header-inner mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/painel" className="flex items-baseline gap-2">
            <BrandLogo inverse />

          </Link>
          <div className="dashboard-header-actions">
            <Link to="/faq" className="dashboard-help" aria-label="Ajuda"><AppIcon name="help" size={21} /><span>Ajuda</span></Link>
            <div className="dashboard-account-slot" ref={setAccountTarget} />
            <div className="dashboard-account-fallback">
              <Link to={showSegmentMark ? meta.path : '/'}>Ver site público</Link>
              {user && <button onClick={handleSignOut}>Sair</button>}
            </div>
          </div>
        </div>
        <BrandAccent height="h-1.5" segment={segmentId} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <DashboardHeaderContext.Provider value={accountTarget}><Outlet /></DashboardHeaderContext.Provider>
      </main>
    </div>
  )
}
