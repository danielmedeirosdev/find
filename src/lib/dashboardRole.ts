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

/** Pure helper used by UI + tests. */
export function pickDashboardMembership(input: {
  ownedShop: Shop | null
  staffBarber: (Barber & { shops?: Shop | Shop[] | null }) | null
}): DashboardMembership | null {
  if (input.ownedShop) {
    return { role: 'owner', shop: input.ownedShop, barber: null }
  }
  const barber = input.staffBarber
  if (!barber) return null
  const shopRaw = barber.shops
  const shop = Array.isArray(shopRaw) ? shopRaw[0] : shopRaw
  if (!shop) return null
  const { shops: _shops, ...barberOnly } = barber as Barber & { shops?: unknown }
  return { role: 'staff', shop, barber: barberOnly }
}
