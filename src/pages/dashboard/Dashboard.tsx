import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Shop } from '../../lib/types'
import { BlockedOverlay } from '../../components/BlockedOverlay'
import { invokeFunction } from '../../lib/supabase'
import { ShopInfoTab } from './tabs/ShopInfo'
import { TeamScheduleTab } from './tabs/TeamSchedule'
import { ServicesTab } from './tabs/Services'
import { AgendaTab } from './tabs/Agenda'
import { CashFlowTab } from './tabs/CashFlow'
import { ReportsTab } from './tabs/Reports'
import { SubscriptionTab } from './tabs/Subscription'
import { ShopLinkTab } from './tabs/ShopLink'

const TABS = [
  { id: 'info', label: 'Informações' },
  { id: 'team', label: 'Equipe e horários' },
  { id: 'services', label: 'Serviços' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'cashflow', label: 'Fluxo de Caixa' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'link', label: 'Link da Barbearia' },
  { id: 'subscription', label: 'Assinatura' },
] as const

type TabId = (typeof TABS)[number]['id']

export function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('aba') as TabId) || 'info'

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

    if (
      data &&
      data.subscription_status === 'trial' &&
      data.trial_ends_at &&
      new Date(data.trial_ends_at) <= new Date()
    ) {
      const { data: updated } = await supabase
        .from('shops')
        .update({ subscription_status: 'blocked' })
        .eq('id', data.id)
        .select('*')
        .single()
      setShop(updated || { ...data, subscription_status: 'blocked' })
    } else {
      setShop(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (user) loadShop()
  }, [user])

  const setTab = (tab: TabId) => {
    setSearchParams({ aba: tab })
  }

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
        setSubscribeError('Pagamento criado, mas o Asaas não retornou link. Tente novamente em alguns segundos.')
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

  if (shop.subscription_status === 'blocked') {
    const blockReason = shop.asaas_customer_id ? 'payment_overdue' : 'trial_expired'
    return (
      <BlockedOverlay
        shopName={shop.name}
        blockReason={blockReason}
        onSubscribe={handleSubscribe}
        loading={subscribing}
        error={subscribeError}
      />
    )
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        {shop.logo_url ? (
          <img
            src={shop.logo_url}
            alt=""
            className="h-14 w-14 rounded-xl object-cover border border-charcoal-light"
          />
        ) : null}
        <div>
          <h1 className="font-display text-4xl text-brass">{shop.name}</h1>
          <p className="text-charcoal-muted text-sm mt-1">Painel de gestão</p>
        </div>
      </div>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-charcoal-light pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-brass text-charcoal'
                : 'text-charcoal-muted hover:text-white hover:bg-charcoal-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'info' && <ShopInfoTab shop={shop} onUpdate={loadShop} />}
      {activeTab === 'team' && <TeamScheduleTab shopId={shop.id} />}
      {activeTab === 'services' && <ServicesTab shopId={shop.id} />}
      {activeTab === 'agenda' && <AgendaTab shopId={shop.id} />}
      {activeTab === 'cashflow' && <CashFlowTab shopId={shop.id} />}
      {activeTab === 'reports' && <ReportsTab shopId={shop.id} />}
      {activeTab === 'link' && <ShopLinkTab shop={shop} onUpdate={loadShop} />}
      {activeTab === 'subscription' && (
        <SubscriptionTab
          shop={shop}
          onUpdate={loadShop}
          onSubscribe={handleSubscribe}
          subscribing={subscribing}
          subscribeError={subscribeError}
        />
      )}
    </div>
  )
}
