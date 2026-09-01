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
import { ReferralTab } from '../tabs/Referral'
import type { ProfessionalTabGroup } from './ProfessionalShell'

const BARBEARIA_TAB_GROUPS: ProfessionalTabGroup[] = [
  {
    label: 'Dia a dia',
    tabs: [
      { id: 'overview', label: 'Visão geral', icon: 'home' },
      { id: 'agenda', label: 'Agenda', icon: 'agenda' },
      { id: 'notifications', label: 'Notificações', icon: 'bell' },
    ],
  },
  {
    label: 'Cadastros',
    tabs: [
      { id: 'team', label: 'Equipe e horários', icon: 'users' },
      { id: 'services', label: 'Serviços', icon: 'briefcase' },
    ],
  },
  {
    label: 'Negócio',
    tabs: [
      { id: 'cashflow', label: 'Fluxo de Caixa', icon: 'wallet' },
      { id: 'reports', label: 'Relatórios', icon: 'chart' },
      { id: 'reviews', label: 'Avaliações', icon: 'star' },
      { id: 'info', label: 'Informações', icon: 'store' },
      { id: 'link', label: 'Link da Barbearia', icon: 'link' },
      { id: 'referral', label: 'Indique e ganhe', icon: 'heart' },
      { id: 'subscription', label: 'Assinatura', icon: 'receipt' },
    ],
  },
]

const BARBEARIA_TABS = BARBEARIA_TAB_GROUPS.flatMap((g) => g.tabs)
type BarbeariaTabId = string

interface Props {
  shop: Shop
  onUpdate: () => void
  onSubscribe: SubscribeHandler
  subscribing: boolean
  subscribeError: string
}

/** Experiência do dono — FIND BARBEARIA. */
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
      tabs={BARBEARIA_TABS}
      tabGroups={BARBEARIA_TAB_GROUPS}
      activeTab={activeTab}
      onTabChange={setTab}
      title={shop.name}
      subtitle="Área do dono"
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
      {activeTab === 'referral' && <ReferralTab shop={shop} onUpdate={onUpdate} />}
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
