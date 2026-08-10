import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Shop, ShopSegment } from '../../lib/types'
import { BlockedOverlay } from '../../components/BlockedOverlay'
import { invokeFunction } from '../../lib/supabase'
import { getSegment } from '../../lib/segments'
import { ShopInfoTab } from './tabs/ShopInfo'
import { TeamScheduleTab } from './tabs/TeamSchedule'
import { ServicesTab } from './tabs/Services'
import { AgendaTab } from './tabs/Agenda'
import { CashFlowTab } from './tabs/CashFlow'
import { ReportsTab } from './tabs/Reports'
import { SubscriptionTab } from './tabs/Subscription'
import { ShopLinkTab } from './tabs/ShopLink'
import { ReviewsTab } from './tabs/Reviews'
import { PetsTab } from './tabs/Pets'
import { CustomersTab } from './tabs/Customers'
import { PackagesTab } from './tabs/Packages'
import { NotificationsTab } from './tabs/Notifications'
import { OverviewTab } from './tabs/Overview'

type TabId =
  | 'overview'
  | 'info'
  | 'team'
  | 'services'
  | 'pets'
  | 'customers'
  | 'packages'
  | 'agenda'
  | 'cashflow'
  | 'reports'
  | 'reviews'
  | 'notifications'
  | 'link'
  | 'subscription'

function tabsForSegment(segment: ShopSegment) {
  if (segment === 'pet') {
    return [
      { id: 'overview' as const, label: 'Visão geral' },
      { id: 'info' as const, label: 'Informações' },
      { id: 'team' as const, label: 'Equipe e horários' },
      { id: 'services' as const, label: 'Serviços' },
      { id: 'customers' as const, label: 'Clientes' },
      { id: 'pets' as const, label: 'Pets' },
      { id: 'packages' as const, label: 'Pacotes' },
      { id: 'agenda' as const, label: 'Agenda' },
      { id: 'notifications' as const, label: 'Notificações' },
      { id: 'cashflow' as const, label: 'Fluxo de Caixa' },
      { id: 'reports' as const, label: 'Relatórios' },
      { id: 'reviews' as const, label: 'Avaliações' },
      { id: 'link' as const, label: 'Link do Pet Shop' },
      { id: 'subscription' as const, label: 'Assinatura' },
    ]
  }
  return [
    { id: 'overview' as const, label: 'Visão geral' },
    { id: 'info' as const, label: 'Informações' },
    { id: 'team' as const, label: 'Equipe e horários' },
    { id: 'services' as const, label: 'Serviços' },
    { id: 'agenda' as const, label: 'Agenda' },
    { id: 'notifications' as const, label: 'Notificações' },
    { id: 'cashflow' as const, label: 'Fluxo de Caixa' },
    { id: 'reports' as const, label: 'Relatórios' },
    { id: 'reviews' as const, label: 'Avaliações' },
    { id: 'link' as const, label: 'Link da Barbearia' },
    { id: 'subscription' as const, label: 'Assinatura' },
  ]
}

export function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('aba') as TabId) || 'overview'

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

  const segment: ShopSegment = shop?.segment === 'pet' ? 'pet' : 'barbershop'
  const segmentMeta = getSegment(segment)
  const tabs = useMemo(() => tabsForSegment(segment), [segment])

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
          <p className="text-xs uppercase tracking-widest text-brass/80 mb-1">
            {segmentMeta.brandName}
          </p>
          <h1 className="font-display text-4xl text-brass">{shop.name}</h1>
          <p className="text-charcoal-muted text-sm mt-1">Painel de gestão</p>
        </div>
      </div>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-charcoal-light pb-4">
        {tabs.map((tab) => (
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

      {activeTab === 'overview' && (
        <OverviewTab shopId={shop.id} segment={segment} onNavigate={(tab) => setTab(tab as TabId)} />
      )}
      {activeTab === 'info' && <ShopInfoTab shop={shop} onUpdate={loadShop} />}
      {activeTab === 'team' && <TeamScheduleTab shopId={shop.id} segment={segment} />}
      {activeTab === 'services' && <ServicesTab shopId={shop.id} segment={segment} />}
      {activeTab === 'customers' && segment === 'pet' && <CustomersTab shopId={shop.id} />}
      {activeTab === 'pets' && segment === 'pet' && <PetsTab shopId={shop.id} />}
      {activeTab === 'packages' && segment === 'pet' && <PackagesTab shopId={shop.id} />}
      {activeTab === 'agenda' && <AgendaTab shopId={shop.id} segment={segment} />}
      {activeTab === 'notifications' && <NotificationsTab shopId={shop.id} />}
      {activeTab === 'cashflow' && <CashFlowTab shopId={shop.id} />}
      {activeTab === 'reports' && <ReportsTab shopId={shop.id} />}
      {activeTab === 'reviews' && <ReviewsTab shopId={shop.id} />}
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
