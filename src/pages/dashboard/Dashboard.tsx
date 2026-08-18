import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase, invokeFunction } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Barber, Shop } from '../../lib/types'
import { BlockedOverlay } from '../../components/BlockedOverlay'
import { SegmentProvider } from '../../contexts/SegmentContext'
import { normalizeSegment, parseSegmentParam } from '../../lib/segments'
import { ensureBarberShop } from '../../lib/auth'
import { pickDashboardMembership, type DashboardRole } from '../../lib/dashboardRole'
import { LoadingBlock } from '../../components/EmptyState'
import { ProfessionalBarbearia } from './professional/ProfessionalBarbearia'
import { ProfessionalPet } from './professional/ProfessionalPet'
import { StaffProfessional } from './professional/StaffProfessional'

/**
 * Entrada do painel: resolve dono vs profissional (staff) e despacha a experiência correta.
 */
export function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [shop, setShop] = useState<Shop | null>(null)
  const [barber, setBarber] = useState<Barber | null>(null)
  const [role, setRole] = useState<DashboardRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeError, setSubscribeError] = useState('')

  const loadMembership = async () => {
    if (!user) return

    try {
      setLoadError('')
      const { data: owned, error: ownedError } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_user_id', user.id)
        .maybeSingle()

      if (ownedError) {
        console.error('Dashboard shop lookup failed', ownedError)
        throw ownedError
      }

      let staffRow: (Barber & { shops?: Shop | null }) | null = null
      if (!owned) {
        const { data, error: staffError } = await supabase
          .from('barbers')
          .select('*, shops(*)')
          .eq('user_id', user.id)
          .maybeSingle()
        if (staffError) {
          console.error('Dashboard staff lookup failed', staffError)
          throw staffError
        }
        staffRow = data as (Barber & { shops?: Shop | null }) | null
      }

      const membership = pickDashboardMembership({
        ownedShop: (owned as Shop) || null,
        staffBarber: staffRow,
      })

      if (!membership) {
        setShop(null)
        setBarber(null)
        setRole(null)
        return
      }

      let resolved = membership.shop
      setRole(membership.role)
      setBarber(membership.barber)

      if (membership.role === 'owner') {
        const dbSegment = normalizeSegment(resolved.segment)
        const metaSegment = normalizeSegment(
          (user.user_metadata as { segment?: string } | undefined)?.segment
        )
        const urlSegment = parseSegmentParam(searchParams.get('segment'))

        if (dbSegment !== 'pet' && (metaSegment === 'pet' || urlSegment === 'pet')) {
          await ensureBarberShop(user.id, resolved.name, 'pet')
          const { data: fixed } = await supabase
            .from('shops')
            .select('*')
            .eq('id', resolved.id)
            .single()
          if (fixed) resolved = fixed as Shop
          else resolved = { ...resolved, segment: 'pet' }
        } else if (dbSegment === 'pet') {
          await ensureBarberShop(user.id, resolved.name, 'pet')
          if (resolved.segment !== dbSegment) {
            resolved = { ...resolved, segment: dbSegment }
          }
        } else if (resolved.segment !== dbSegment) {
          resolved = { ...resolved, segment: dbSegment }
        }

        if (
          resolved.subscription_status === 'trial' &&
          resolved.trial_ends_at &&
          new Date(resolved.trial_ends_at) <= new Date() &&
          !(resolved.complimentary_until && new Date(resolved.complimentary_until) > new Date())
        ) {
          const { data: expired } = await supabase.rpc('expire_my_expired_trial')
          const status =
            (expired as { subscription_status?: string } | null)?.subscription_status || 'blocked'
          if (status === 'blocked') {
            const { data: refreshed } = await supabase
              .from('shops')
              .select('*')
              .eq('id', resolved.id)
              .maybeSingle()
            resolved = (refreshed as Shop) || { ...resolved, subscription_status: 'blocked' }
          }
        }
      }

      setShop(resolved)
    } catch (err) {
      console.error('Dashboard membership failed', err)
      setShop(null)
      setBarber(null)
      setRole(null)
      setLoadError('Não foi possível carregar o painel. Atualize a página e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    loadMembership()
  }, [user, authLoading, searchParams])

  const handleSubscribe = async (billingType: 'PIX' | 'CREDIT_CARD' = 'PIX') => {
    if (!shop || role !== 'owner') return
    setSubscribing(true)
    setSubscribeError('')
    try {
      const result = await invokeFunction<{ paymentLink?: string; alreadyActive?: boolean }>(
        'create-subscription',
        {
          shop_id: shop.id,
          billing_type: billingType,
        }
      )
      if (result.alreadyActive) {
        await loadMembership()
        return
      }
      if (!result.paymentLink) {
        setSubscribeError(
          'Pagamento criado, mas o Asaas não retornou link. Tente novamente em alguns segundos.'
        )
        return
      }
      const paymentUrl = new URL(result.paymentLink)
      if (
        paymentUrl.protocol !== 'https:' ||
        (paymentUrl.hostname !== 'asaas.com' && !paymentUrl.hostname.endsWith('.asaas.com'))
      ) {
        throw new Error('O provedor retornou um endereço de pagamento inválido.')
      }
      const opened = window.open(paymentUrl.href, '_blank', 'noopener,noreferrer')
      if (!opened) {
        window.location.assign(paymentUrl.href)
      }
      await loadMembership()
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : 'Erro ao criar assinatura.')
    }
    setSubscribing(false)
  }

  if (authLoading || loading) {
    return <LoadingBlock label="Carregando painel..." />
  }

  if (!user) return <Navigate to="/painel" replace />
  if (loadError) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-charcoal-light p-6 text-center">
        <p className="text-white font-medium">Não foi possível abrir o painel</p>
        <p className="mt-2 text-sm text-charcoal-muted">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            loadMembership()
          }}
          className="mt-5 rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal"
        >
          Tentar novamente
        </button>
      </div>
    )
  }
  if (!shop || !role) return <Navigate to="/painel" replace />

  const isPet = normalizeSegment(shop.segment) === 'pet'
  const complimentaryActive =
    Boolean(shop.complimentary_until) && new Date(shop.complimentary_until as string) > new Date()

  if (shop.subscription_status === 'blocked' && !complimentaryActive) {
    if (role === 'staff') {
      return (
        <SegmentProvider segment={isPet ? 'pet' : 'barbershop'}>
          <div className="mx-auto max-w-lg rounded-xl border border-charcoal-light p-6 text-center">
            <h1 className="font-display text-2xl text-brass">Estabelecimento indisponível</h1>
            <p className="mt-3 text-sm text-charcoal-muted">
              O acesso do {shop.name} está temporariamente bloqueado. Peça ao dono para regularizar a
              assinatura.
            </p>
          </div>
        </SegmentProvider>
      )
    }
    const blockReason = shop.asaas_customer_id ? 'payment_overdue' : 'trial_expired'
    return (
      <SegmentProvider segment={isPet ? 'pet' : 'barbershop'}>
        <BlockedOverlay
          shopName={shop.name}
          segment={isPet ? 'pet' : 'barbershop'}
          blockReason={blockReason}
          onSubscribe={handleSubscribe}
          loading={subscribing}
          error={subscribeError}
        />
      </SegmentProvider>
    )
  }

  if (role === 'staff' && barber) {
    return <StaffProfessional shop={shop} barber={barber} onUpdate={loadMembership} />
  }

  if (isPet) {
    return (
      <ProfessionalPet
        shop={{ ...shop, segment: 'pet' }}
        onUpdate={loadMembership}
        onSubscribe={handleSubscribe}
        subscribing={subscribing}
        subscribeError={subscribeError}
      />
    )
  }

  return (
    <ProfessionalBarbearia
      shop={{ ...shop, segment: 'barbershop' }}
      onUpdate={loadMembership}
      onSubscribe={handleSubscribe}
      subscribing={subscribing}
      subscribeError={subscribeError}
    />
  )
}
