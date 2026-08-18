import { useSearchParams } from 'react-router-dom'
import type { Barber, Shop } from '../../../lib/types'
import { normalizeSegment } from '../../../lib/segments'
import { ProfessionalShell } from './ProfessionalShell'
import { STAFF_TABS, resolveStaffTab } from '../../../lib/dashboardRole'
import { AgendaTab } from '../tabs/Agenda'
import { PetAgenda } from './pet/PetAgenda'
import { StaffClientsTab } from './staff/StaffClients'
import { StaffServicesTab } from './staff/StaffServices'
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
  const activeTab = resolveStaffTab(searchParams.get('aba'))
  const isPet = normalizeSegment(shop.segment) === 'pet'
  const setTab = (tab: string) => setSearchParams({ aba: tab })

  return (
    <ProfessionalShell
      shop={shop}
      segment={isPet ? 'pet' : 'barbershop'}
      tabs={[...STAFF_TABS]}
      activeTab={activeTab}
      onTabChange={setTab}
      title={barber.name}
      subtitle={`${shop.name} · área do profissional`}
    >
      {activeTab === 'agenda' &&
        (isPet ? (
          <PetAgenda shopId={shop.id} barberId={barber.id} />
        ) : (
          <AgendaTab shopId={shop.id} barberId={barber.id} />
        ))}
      {activeTab === 'clients' && <StaffClientsTab shopId={shop.id} barberId={barber.id} />}
      {activeTab === 'services' && <StaffServicesTab shopId={shop.id} />}
      {activeTab === 'profile' && (
        <StaffProfileTab shop={shop} barber={barber} onUpdate={onUpdate} />
      )}
    </ProfessionalShell>
  )
}
