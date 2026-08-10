import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase, invokeFunction } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Shop } from '../../lib/types'
import { BlockedOverlay } from '../../components/BlockedOverlay'
import { SegmentProvider } from '../../contexts/SegmentContext'
import { normalizeSegment, parseSegmentParam } from '../../lib/segments'
import { ProfessionalBarbearia } from './professional/ProfessionalBarbearia'
import { ProfessionalPet } from './professional/ProfessionalPet'

/**
 * Entrada do painel profissional.
 * Carrega a loja e despacha para a experiência do segmento:
 * - barbershop → ProfessionalBarbearia
 * - pet → ProfessionalPet
 *
 * Também corrige lojas cujo segment no banco ficou errado (ex.: cadastro PET
 * que herdou default barbershop) usando metadata do usuário ou ?segment=pet.
 */
export function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeError, setSubscribeError] = useState('')

  const loadShop = async () => {
    if (!user) return
    const { data } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (!data) {
      setShop(null)
      setLoading(false)
      return
    }

    let resolved: Shop = data as Shop
    const dbSegment = normalizeSegment(resolved.segment)
    const metaSegment = normalizeSegment(
      (user.user_metadata as { segment?: string } | undefined)?.segment
    )
    const urlSegment = parseSegmentParam(searchParams.get('segment'))

    // Cura: loja criada como barbearia por default, mas o profissional é PET
    if (dbSegment !== 'pet' && (metaSegment === 'pet' || urlSegment === 'pet')) {
      const { data: fixed } = await supabase
        .from('shops')
        .update({ segment: 'pet' })
        .eq('id', resolved.id)
        .select('*')
        .single()
      if (fixed) resolved = fixed as Shop
      else resolved = { ...resolved, segment: 'pet' }
    } else if (resolved.segment !== dbSegment) {
      resolved = { ...resolved, segment: dbSegment }
    }

    if (
      resolved.subscription_status === 'trial' &&
      resolved.trial_ends_at &&
      new Date(resolved.trial_ends_at) <= new Date()
    ) {
      const { data: updated } = await supabase
        .from('shops')
        .update({ subscription_status: 'blocked' })
        .eq('id', resolved.id)
        .select('*')
        .single()
      setShop((updated as Shop) || { ...resolved, subscription_status: 'blocked' })
    } else {
      setShop(resolved)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    loadShop()
  }, [user, authLoading, searchParams])

  const handleSubscribe = async (billingType: 'PIX' | 'CREDIT_CARD' = 'PIX') => {
    if (!shop) return
    setSubscribing(true)
    setSubscribeError('')
    try {
      const result = await invokeFunction<{ paymentLink?: string }>('create-subscription', {
        shop_id: shop.id,
        billing_type: billingType,
      })
      if (!result.paymentLink) {
        setSubscribeError(
          'Pagamento criado, mas o Asaas não retornou link. Tente novamente em alguns segundos.'
        )
        return
      }
      const opened = window.open(result.paymentLink, '_blank', 'noopener,noreferrer')
      if (!opened) {
        window.location.assign(result.paymentLink)
      }
      await loadShop()
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : 'Erro ao criar assinatura.')
    }
    setSubscribing(false)
  }

  if (authLoading || loading) {
    return <p className="text-center text-charcoal-muted">Carregando...</p>
  }

  if (!user) return <Navigate to="/painel" replace />
  if (!shop) return <Navigate to="/painel" replace />

  const isPet = normalizeSegment(shop.segment) === 'pet'

  if (shop.subscription_status === 'blocked') {
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

  if (isPet) {
    return (
      <ProfessionalPet
        shop={{ ...shop, segment: 'pet' }}
        onUpdate={loadShop}
        onSubscribe={handleSubscribe}
        subscribing={subscribing}
        subscribeError={subscribeError}
      />
    )
  }

  return (
    <ProfessionalBarbearia
      shop={{ ...shop, segment: 'barbershop' }}
      onUpdate={loadShop}
      onSubscribe={handleSubscribe}
      subscribing={subscribing}
      subscribeError={subscribeError}
    />
  )
}
