import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BrandAccent } from './BrandAccent'
import { SetupBanner } from './SetupBanner'
import { getSegment, normalizeSegment, parseSegmentParam } from '../lib/segments'
import { supabase } from '../lib/supabase'
import type { ShopSegment } from '../lib/types'

export function DashboardLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const segmentParam = parseSegmentParam(params.get('segment'))
  const [shopSegment, setShopSegment] = useState<ShopSegment | null>(null)
  const [segmentResolved, setSegmentResolved] = useState(false)

  useEffect(() => {
    if (!user) {
      setShopSegment(null)
      setSegmentResolved(true)
      return
    }
    setSegmentResolved(false)
    let cancelled = false
    supabase
      .from('shops')
      .select('segment')
      .eq('owner_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setShopSegment(data ? normalizeSegment(data.segment) : null)
        setSegmentResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const segmentId: ShopSegment | 'platform' =
    segmentParam || shopSegment || (segmentResolved ? 'barbershop' : 'platform')
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
      className={`min-h-screen bg-charcoal text-white ${themeClass}`}
      data-segment={segmentId === 'platform' ? undefined : segmentId}
    >
      <SetupBanner />
      <header className="border-b border-charcoal-light bg-charcoal">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/painel" className="flex items-baseline gap-2">
            <span className="font-display text-3xl tracking-wider text-brass">FIND</span>
            {showSegmentMark && (
              <span className="text-xs uppercase tracking-widest text-brass/70">{meta.shortName}</span>
            )}
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              to={showSegmentMark ? meta.path : '/'}
              className="text-charcoal-muted hover:text-brass transition-colors"
            >
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
        <BrandAccent height="h-1.5" segment={segmentId} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
