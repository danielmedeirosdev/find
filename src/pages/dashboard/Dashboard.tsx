import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase, invokeFunction } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Barber, Shop } from '../../lib/types'
import { BlockedOverlay } from '../../components/BlockedOverlay'
import { SegmentProvider } from '../../contexts/SegmentContext'
import { normalizeSegment, parseSegmentParam } from '../../lib/segments'
import { pickDashboardMembership, type DashboardRole } from '../../lib/dashboardRole'
import { userFacingError } from '../../lib/userFacingError'
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
  const searchParamsRef = useRef(searchParams)
  searchParamsRef.current = searchParams
  const userRef = useRef(user)
  userRef.current = user
  const [shop, setShop] = useState<Shop | null>(null)
  const [barber, setBarber] = useState<Barber | null>(null)
  const [role, setRole] = useState<DashboardRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeError, setSubscribeError] = useState('')

  const loadMembership = useCallback(async (opts?: { silent?: boolean }) => {
    const currentUser = userRef.current
    if (!currentUser) return

    try {
      if (!opts?.silent) setLoadError('')

      const [{ data: owned, error: ownedError }, { data: staffRow, error: staffError }] =
        await Promise.all([
          supabase.from('shops').select('*').eq('owner_user_id', currentUser.id).maybeSingle(),
          supabase.from('barbers').select('*').eq('user_id', currentUser.id).maybeSingle(),
        ])

      if (ownedError) {
        console.error('Dashboard shop lookup failed', ownedError)
        throw ownedError
      }
      if (staffError) {
        console.error('Dashboard staff lookup failed', staffError)
        throw staffError
      }

      const staffBarber = (staffRow as Barber | null) || null
      let staffShop: Shop | null = null
      if (staffBarber?.shop_id) {
        const { data: linkedShop, error: linkedShopError } = await supabase
          .from('shops')
          .select('*')
          .eq('id', staffBarber.shop_id)
          .maybeSingle()
        if (linkedShopError) {
          console.error('Dashboard staff shop lookup failed', linkedShopError)
          throw linkedShopError
        }
        staffShop = (linkedShop as Shop) || null
      }

      const metaRole =
        (currentUser.user_metadata as { role?: string } | undefined)?.role || null

      const membership = pickDashboardMembership({
        ownedShop: (owned as Shop) || null,
        staffBarber,
        staffShop,
        metaRole,
      })

      if (
        staffBarber &&
        (!membership ||
          (membership.role === 'owner' && staffBarber.shop_id !== membership.shop.id))
      ) {
        setShop(null)
        setBarber(null)
        setRole(null)
        setLoadError(
          'Não foi possível abrir a área do profissional. Atualize a página ou solicite um novo acesso ao responsável.'
        )
        return
      }

      if (!membership) {
        if ((metaRole || '').toLowerCase() === 'staff') {
          setShop(null)
          setBarber(null)
          setRole(null)
          setLoadError(
            'Não foi possível abrir a área do profissional. Atualize a página ou solicite um novo acesso ao responsável.'
          )
          return
        }
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
          (currentUser.user_metadata as { segment?: string } | undefined)?.segment
        )
        const urlSegment = parseSegmentParam(searchParamsRef.current.get('segment'))

        if (dbSegment !== 'pet' && (metaSegment === 'pet' || urlSegment === 'pet')) {
          const { error: segmentError } = await supabase
            .from('shops')
            .update({ segment: 'pet' })
            .eq('id', resolved.id)
          if (!segmentError) {
            resolved = { ...resolved, segment: 'pet' }
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
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setShop(null)
      setBarber(null)
      setRole(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void loadMembership()
  }, [user?.id, authLoading, loadMembership])

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
        await loadMembership({ silent: true })
        return
      }
      if (!result.paymentLink) {
        setSubscribeError(
          'O pagamento foi registrado, mas o link não ficou disponível. Tente novamente em instantes.'
        )
        return
      }
      const paymentUrl = new URL(result.paymentLink)
      if (
        paymentUrl.protocol !== 'https:' ||
        (paymentUrl.hostname !== 'asaas.com' && !paymentUrl.hostname.endsWith('.asaas.com'))
      ) {
        throw new Error('O endereço de pagamento é inválido. Tente novamente em instantes.')
      }
      const opened = window.open(paymentUrl.href, '_blank', 'noopener,noreferrer')
      if (!opened) {
        window.location.assign(paymentUrl.href)
      }
      await loadMembership({ silent: true })
    } catch (err) {
      setSubscribeError(userFacingError(err, 'Não foi possível iniciar a assinatura. Tente novamente.'))
    }
    setSubscribing(false)
  }

  if (authLoading || loading) {
    return <LoadingBlock label="Carregando o painel..." />
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
            void loadMembership()
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
              O acesso a {shop.name} está temporariamente bloqueado. Solicite ao responsável que
              regularize a assinatura.
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

  if (role === 'staff') {
    if (!barber) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-charcoal-light p-6 text-center">
          <p className="text-white font-medium">Não foi possível abrir a área do profissional</p>
          <p className="mt-2 text-sm text-charcoal-muted">
            Seu acesso de equipe está incompleto. Solicite ao responsável que recrie o login.
          </p>
        </div>
      )
    }
    return (
      <StaffProfessional
        shop={shop}
        barber={barber}
        onUpdate={() => {
          void loadMembership({ silent: true })
        }}
      />
    )
  }

  if (isPet) {
    return (
      <ProfessionalPet
        shop={{ ...shop, segment: 'pet' }}
        onUpdate={() => {
          void loadMembership({ silent: true })
        }}
        onSubscribe={handleSubscribe}
        subscribing={subscribing}
        subscribeError={subscribeError}
      />
    )
  }

  return (
    <ProfessionalBarbearia
      shop={{ ...shop, segment: 'barbershop' }}
      onUpdate={() => {
        void loadMembership({ silent: true })
      }}
      onSubscribe={handleSubscribe}
      subscribing={subscribing}
      subscribeError={subscribeError}
    />
  )
}
