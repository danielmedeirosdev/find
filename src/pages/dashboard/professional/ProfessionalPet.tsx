import { lazy, Suspense } from 'react'
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
import { ReferralTab } from '../tabs/Referral'

const PetClinical = lazy(() =>
  import('./pet/PetClinical').then((module) => ({ default: module.PetClinical }))
)
const PetInventory = lazy(() =>
  import('./pet/PetInventory').then((module) => ({ default: module.PetInventory }))
)

const PET_TAB_GROUPS: { label: string; tabs: { id: string; label: string }[] }[] = [
  {
    label: 'Dia a dia',
    tabs: [
      { id: 'overview', label: 'Visão geral' },
      { id: 'agenda', label: 'Agenda' },
    ],
  },
  {
    label: 'Cadastros',
    tabs: [
      { id: 'pets', label: 'Pets' },
      { id: 'customers', label: 'Clientes' },
      { id: 'services', label: 'Serviços' },
      { id: 'team', label: 'Equipe' },
      { id: 'packages', label: 'Pacotes' },
    ],
  },
  {
    label: 'Negócio',
    tabs: [
      { id: 'cashflow', label: 'Financeiro' },
      { id: 'reports', label: 'Relatórios' },
      { id: 'reviews', label: 'Avaliações' },
      { id: 'info', label: 'Meu pet shop' },
      { id: 'link', label: 'Link público' },
      { id: 'referral', label: 'Indique e ganhe' },
      { id: 'subscription', label: 'Plano' },
    ],
  },
]

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
  const resourceTabs: { id: string; label: string }[] = []
  if (shop.pet_business_type === 'veterinary_clinic' || shop.pet_business_type === 'mixed') {
    resourceTabs.push({ id: 'clinical', label: 'Consultas e vacinas' })
  }
  if (shop.pet_business_type === 'pet_shop' || shop.pet_business_type === 'mixed') {
    resourceTabs.push({ id: 'inventory', label: 'Estoque' })
  }
  const petTabGroups = resourceTabs.length
    ? [
        ...PET_TAB_GROUPS.slice(0, 2),
        { label: 'Recursos PET', tabs: resourceTabs },
        ...PET_TAB_GROUPS.slice(2),
      ]
    : PET_TAB_GROUPS
  const petTabs = petTabGroups.flatMap((group) => group.tabs)
  const raw = searchParams.get('aba') || 'overview'
  const activeTab: PetTabId = petTabs.some((t) => t.id === raw)
    ? (raw as PetTabId)
    : 'overview'

  const setTab = (tab: string) => setSearchParams({ aba: tab })

  return (
    <ProfessionalShell
      shop={shop}
      segment="pet"
      tabs={petTabs}
      tabGroups={petTabGroups}
      activeTab={activeTab}
      onTabChange={setTab}
      title={shop.name?.trim() || 'Meu Pet Shop'}
      subtitle="Gestão profissional para negócios PET"
    >
      {activeTab === 'overview' && (
        <PetOverview shopId={shop.id} businessType={shop.pet_business_type} onNavigate={setTab} />
      )}
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
      {activeTab === 'clinical' ? (
        <Suspense fallback={<p className="text-charcoal-muted">Carregando clínica...</p>}>
          <PetClinical shopId={shop.id} />
        </Suspense>
      ) : null}
      {activeTab === 'inventory' ? (
        <Suspense fallback={<p className="text-charcoal-muted">Carregando estoque...</p>}>
          <PetInventory shopId={shop.id} />
        </Suspense>
      ) : null}
      {activeTab === 'link' && <PetShopLink shop={shop} onUpdate={onUpdate} />}
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
