import type { Barber, Shop } from './types'

export type DashboardRole = 'owner' | 'staff'

export const OWNER_ONLY_TABS = new Set([
  'cashflow',
  'reports',
  'subscription',
  'referral',
  'info',
  'link',
  'team',
  'notifications',
  'packages',
])

export const STAFF_TABS = [
  { id: 'agenda', label: 'Minha agenda' },
  { id: 'clients', label: 'Meus clientes' },
  { id: 'services', label: 'Meus serviços' },
  { id: 'profile', label: 'Meu perfil' },
] as const

export type StaffTabId = (typeof STAFF_TABS)[number]['id']

export function isOwnerOnlyTab(tab: string): boolean {
  return OWNER_ONLY_TABS.has(tab)
}

export function resolveStaffTab(raw: string | null): StaffTabId {
  const value = raw || 'agenda'
  return STAFF_TABS.some((t) => t.id === value) ? (value as StaffTabId) : 'agenda'
}

export interface DashboardMembership {
  role: DashboardRole
  shop: Shop
  barber: Barber | null
}

function shopFromBarberEmbed(
  barber: (Barber & { shops?: Shop | Shop[] | null }) | null
): Shop | null {
  if (!barber) return null
  const shopRaw = barber.shops
  const shop = Array.isArray(shopRaw) ? shopRaw[0] : shopRaw
  return shop ?? null
}

function staffMembership(shop: Shop, barber: Barber): DashboardMembership {
  const { shops: _shops, ...barberOnly } = barber as Barber & { shops?: unknown }
  return { role: 'staff', shop, barber: barberOnly }
}

/**
 * Resolve dono vs profissional.
 * - metadata `staff` sempre vai para a área do profissional quando o vínculo existe.
 * - vínculo em outra loja vence uma loja "dona" acidental (ex.: Google no /painel).
 * - dono listado como barbeiro na própria loja continua na área administrativa.
 */
export function pickDashboardMembership(input: {
  ownedShop: Shop | null
  staffBarber: (Barber & { shops?: Shop | Shop[] | null }) | null
  staffShop?: Shop | null
  metaRole?: string | null
}): DashboardMembership | null {
  const barber = input.staffBarber
  const staffShop = input.staffShop ?? shopFromBarberEmbed(barber)
  const staffReady = Boolean(barber && staffShop)
  const metaStaff = (input.metaRole || '').toLowerCase() === 'staff'

  if (staffReady && metaStaff) {
    return staffMembership(staffShop as Shop, barber as Barber)
  }

  if (staffReady && input.ownedShop && (staffShop as Shop).id !== input.ownedShop.id) {
    return staffMembership(staffShop as Shop, barber as Barber)
  }

  if (input.ownedShop && !metaStaff) {
    return { role: 'owner', shop: input.ownedShop, barber: null }
  }

  if (staffReady) {
    return staffMembership(staffShop as Shop, barber as Barber)
  }

  return null
}
