import { useSearchParams } from 'react-router-dom'
import type { Shop, SubscribeHandler } from '../../../lib/types'
import { ProfessionalShell } from './ProfessionalShell'
import { PetOverview } from './pet/PetOverview'
import { PetShopInfo } from './pet/PetShopInfo'
import { PetServices } from './pet/PetServices'
import { PetAgenda } from './pet/PetAgenda'
import { PetTeam } from './pet/PetTeam'
import { PetShopLink } from './pet/PetShopLink'
import { PetReviews } from './pet/PetReviews'
import { PetsTab } from '../tabs/Pets'
import { CustomersTab } from '../tabs/Customers'
import { PackagesTab } from '../tabs/Packages'
import { CashFlowTab } from '../tabs/CashFlow'
import { ReportsTab } from '../tabs/Reports'
import { SubscriptionTab } from '../tabs/Subscription'

const PET_TAB_GROUPS: { label: string; tabs: { id: string; label: string }[] }[] = [
  {
    label: 'Dia a dia',
    tabs: [
      { id: 'overview', label: 'Início' },
      { id: 'agenda', label: 'Agenda' },
    ],
  },
  {
    label: 'Cadastros',
    tabs: [
      { id: 'pets', label: 'Pets' },
      { id: 'customers', label: 'Donos' },
      { id: 'services', label: 'Serviços' },
      { id: 'team', label: 'Equipe' },
      { id: 'packages', label: 'Pacotes' },
    ],
  },
  {
    label: 'Negócio',
    tabs: [
      { id: 'cashflow', label: 'Caixa' },
      { id: 'reports', label: 'Relatórios' },
      { id: 'reviews', label: 'Avaliações' },
      { id: 'info', label: 'Meu pet shop' },
      { id: 'link', label: 'Link público' },
      { id: 'subscription', label: 'Plano' },
    ],
  },
]

const PET_TABS = PET_TAB_GROUPS.flatMap((g) => g.tabs)
type PetTabId = string

interface Props {
  shop: Shop
  onUpdate: () => void
  onSubscribe: SubscribeHandler
  subscribing: boolean
  subscribeError: string
}

/** Experiência profissional FIND PET — gestão de pet shop / banho e tosa. */
export function ProfessionalPet({
  shop,
  onUpdate,
  onSubscribe,
  subscribing,
  subscribeError,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('aba') || 'overview'
  const activeTab: PetTabId = PET_TABS.some((t) => t.id === raw)
    ? (raw as PetTabId)
    : 'overview'

  const setTab = (tab: string) => setSearchParams({ aba: tab })

  return (
    <ProfessionalShell
      shop={shop}
      segment="pet"
      tabs={PET_TABS}
      tabGroups={PET_TAB_GROUPS}
      activeTab={activeTab}
      onTabChange={setTab}
      title={shop.name?.trim() || 'Meu Pet Shop'}
      subtitle="Banho, tosa e cuidados"
    >
      {activeTab === 'overview' && <PetOverview shopId={shop.id} onNavigate={setTab} />}
      {activeTab === 'info' && <PetShopInfo shop={shop} onUpdate={onUpdate} />}
      {activeTab === 'team' && <PetTeam shopId={shop.id} />}
      {activeTab === 'services' && <PetServices shopId={shop.id} />}
      {activeTab === 'agenda' && <PetAgenda shopId={shop.id} />}
      {activeTab === 'customers' && <CustomersTab shopId={shop.id} />}
      {activeTab === 'pets' && <PetsTab shopId={shop.id} />}
      {activeTab === 'packages' && <PackagesTab shopId={shop.id} />}
      {activeTab === 'cashflow' && <CashFlowTab shopId={shop.id} />}
      {activeTab === 'reports' && <ReportsTab shopId={shop.id} />}
      {activeTab === 'reviews' && <PetReviews shopId={shop.id} />}
      {activeTab === 'link' && <PetShopLink shop={shop} onUpdate={onUpdate} />}
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
