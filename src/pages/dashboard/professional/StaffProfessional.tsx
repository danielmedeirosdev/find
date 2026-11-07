import { useSearchParams } from 'react-router-dom'
import type { Barber, Shop } from '../../../lib/types'
import { normalizeSegment } from '../../../lib/segments'
import { ProfessionalShell } from './ProfessionalShell'
import { STAFF_TABS, resolveStaffTab } from '../../../lib/dashboardRole'
import { AgendaTab } from '../tabs/Agenda'
import { PetAgenda } from './pet/PetAgenda'
import { StaffClientsTab } from './staff/StaffClients'
import { StaffServicesTab } from './staff/StaffServices'
import { CustomersTab } from '../tabs/Customers'
import { PetsTab } from '../tabs/Pets'
import { PackagesTab } from '../tabs/Packages'
import { PetServices } from './pet/PetServices'
import { StaffProfileTab } from './staff/StaffProfile'

interface Props {
  shop: Shop
  barber: Barber
  onUpdate: () => void
}

/**
 * Experiência do profissional (funcionário): execução, sem admin financeiro/assinatura/equipe.
 * Rotas admin são redirecionadas para agenda.
 */
export function StaffProfessional({ shop, barber, onUpdate }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const operations = barber.can_manage_operations === true
  const operationTabs = [{id:'agenda',label:'Agenda da loja'}, {id:'clients',label:'Clientes'}, {id:'pets',label:'Pets'}, {id:'services',label:'Serviços'}, {id:'packages',label:'Pacotes'}, {id:'profile',label:'Meu perfil'}]
  const raw = searchParams.get('aba') || 'agenda'
  const activeTab = operations ? (operationTabs.some(tab=>tab.id===raw) ? raw : 'agenda') : resolveStaffTab(raw)
  const isPet = normalizeSegment(shop.segment) === 'pet'
  const setTab = (tab: string) => setSearchParams({ aba: tab })

  return (
    <ProfessionalShell
      shop={shop}
      segment={isPet ? 'pet' : 'barbershop'}
      tabs={operations ? operationTabs : [...STAFF_TABS]}
      activeTab={activeTab}
      onTabChange={setTab}
      title={barber.name}
      subtitle={`${shop.name} · área do profissional`}
    >
      {activeTab === 'agenda' &&
        (isPet ? (
          <PetAgenda shopId={shop.id} shopName={shop.name} barberId={barber.id} shopAgendaAccess={barber.can_manage_operations === true} />
        ) : (
          <AgendaTab shopId={shop.id} barberId={barber.id} />
        ))}
      {activeTab === 'clients' && (operations ? <CustomersTab shopId={shop.id} /> : <StaffClientsTab shopId={shop.id} barberId={barber.id} />)}
      {operations && activeTab === 'pets' && <PetsTab shopId={shop.id} />}
      {operations && activeTab === 'packages' && <PackagesTab shopId={shop.id} operationalOnly />}
      {activeTab === 'services' && (operations ? <PetServices shopId={shop.id} /> : <StaffServicesTab shopId={shop.id} />)}
      {activeTab === 'profile' && (
        <StaffProfileTab shop={shop} barber={barber} onUpdate={onUpdate} />
      )}
    </ProfessionalShell>
  )
}
