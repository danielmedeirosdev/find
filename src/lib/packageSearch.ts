import type { CustomerPackage } from './types'

export type PackagePaymentFilter = 'all' | 'pending' | 'paid'
export type PackageSort = 'customer' | 'recent'
export interface PackageBalance { package_id: string; balance: number | string }
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()

export function findCustomerPackages(
  packages: CustomerPackage[],
  balances: PackageBalance[],
  search: string,
  payment: PackagePaymentFilter,
  sort: PackageSort = 'customer',
): CustomerPackage[] {
  const terms = normalize(search).split(/\s+/).filter(Boolean)
  const amounts = new Map(balances.map(item => [item.package_id, Number(item.balance)]))
  return packages.filter(pkg => {
    const text = normalize([pkg.shop_customers?.name, pkg.pets?.name, pkg.service_packages?.name].filter(Boolean).join(' '))
    if (!terms.every(term => text.includes(term))) return false
    const amount = amounts.get(pkg.id)
    // A legacy package without a recorded sale has no known payment status.
    if (payment !== 'all' && (amount === undefined || !Number.isFinite(amount))) return false
    return payment === 'all' || (payment === 'pending' ? amount! > 0 : amount === 0)
  }).sort((a, b) => {
    if (sort === 'recent') return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)
    return collator.compare(a.shop_customers?.name || '', b.shop_customers?.name || '')
      || collator.compare(a.pets?.name || '', b.pets?.name || '')
      || collator.compare(a.service_packages?.name || '', b.service_packages?.name || '')
      || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)
  })
}
