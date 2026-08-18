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

const BARBEARIA_TAB_GROUPS: { label: string; tabs: { id: string; label: string }[] }[] = [
  {
    label: 'Dia a dia',
    tabs: [
      { id: 'overview', label: 'Visão geral' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'notifications', label: 'Notificações' },
    ],
  },
  {
    label: 'Cadastros',
    tabs: [
      { id: 'team', label: 'Equipe e horários' },
      { id: 'services', label: 'Serviços' },
    ],
  },
  {
    label: 'Negócio',
    tabs: [
      { id: 'cashflow', label: 'Fluxo de Caixa' },
      { id: 'reports', label: 'Relatórios' },
      { id: 'reviews', label: 'Avaliações' },
      { id: 'info', label: 'Informações' },
      { id: 'link', label: 'Link da Barbearia' },
      { id: 'referral', label: 'Indique e ganhe' },
      { id: 'subscription', label: 'Assinatura' },
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
