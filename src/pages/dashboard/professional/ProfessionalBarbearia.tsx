import { useSearchParams } from 'react-router-dom'
import type { Shop, SubscribeHandler } from '../../../lib/types'
import { ProfessionalShell } from './ProfessionalShell'
import { OverviewTab } from '../tabs/Overview'
import { ShopInfoTab } from '../tabs/ShopInfo'
import { TeamScheduleTab } from '../tabs/TeamSchedule'
import { ServicesTab } from '../tabs/Services'
import { AgendaTab } from '../tabs/Agenda'
import { NotificationsTab } from '../tabs/Notifications'
import { CashFlowTab } from '../tabs/CashFlow'
import { ReportsTab } from '../tabs/Reports'
import { ReviewsTab } from '../tabs/Reviews'
import { ShopLinkTab } from '../tabs/ShopLink'
import { SubscriptionTab } from '../tabs/Subscription'

const BARBEARIA_TABS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'info', label: 'Informações' },
  { id: 'team', label: 'Equipe e horários' },
  { id: 'services', label: 'Serviços' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'notifications', label: 'Notificações' },
  { id: 'cashflow', label: 'Fluxo de Caixa' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'reviews', label: 'Avaliações' },
  { id: 'link', label: 'Link da Barbearia' },
  { id: 'subscription', label: 'Assinatura' },
] as const

type BarbeariaTabId = (typeof BARBEARIA_TABS)[number]['id']

interface Props {
  shop: Shop
  onUpdate: () => void
  onSubscribe: SubscribeHandler
  subscribing: boolean
  subscribeError: string
}

/** Experiência profissional FIND BARBEARIA — preserva o produto atual. */
export function ProfessionalBarbearia({
  shop,
  onUpdate,
  onSubscribe,
  subscribing,
  subscribeError,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('aba') || 'overview'
  const activeTab: BarbeariaTabId = BARBEARIA_TABS.some((t) => t.id === raw)
    ? (raw as BarbeariaTabId)
    : 'overview'

  const setTab = (tab: string) => setSearchParams({ aba: tab })

  return (
    <ProfessionalShell
      shop={shop}
      segment="barbershop"
      tabs={[...BARBEARIA_TABS]}
      activeTab={activeTab}
      onTabChange={setTab}
      title={shop.name}
    >
      {activeTab === 'overview' && (
        <OverviewTab shopId={shop.id} onNavigate={setTab} />
      )}
      {activeTab === 'info' && <ShopInfoTab shop={shop} onUpdate={onUpdate} />}
      {activeTab === 'team' && <TeamScheduleTab shopId={shop.id} />}
      {activeTab === 'services' && <ServicesTab shopId={shop.id} />}
      {activeTab === 'agenda' && <AgendaTab shopId={shop.id} />}
      {activeTab === 'notifications' && <NotificationsTab shopId={shop.id} />}
      {activeTab === 'cashflow' && <CashFlowTab shopId={shop.id} />}
      {activeTab === 'reports' && <ReportsTab shopId={shop.id} />}
      {activeTab === 'reviews' && <ReviewsTab shopId={shop.id} segment="barbershop" />}
      {activeTab === 'link' && <ShopLinkTab shop={shop} onUpdate={onUpdate} />}
      {activeTab === 'subscription' && (
        <SubscriptionTab
          shop={shop}
          onUpdate={onUpdate}
          onSubscribe={onSubscribe}
          subscribing={subscribing}
          subscribeError={subscribeError}
        />
      )}
    </ProfessionalShell>
  )
}
