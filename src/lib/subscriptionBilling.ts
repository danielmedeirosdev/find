export interface SubscriptionBilling {
  paidUntil: string | null
  daysRemaining: number | null
  nextDueDate: string | null
  billingType: string | null
  automaticRenewal: boolean
  cardLast4: string | null
  cardBrand: string | null
  canConfigureCard: boolean
  hasSubscription: boolean
  pixAutomatic?: 'unavailable' | 'unverified'
  nextPixInvoiceUrl?: string | null
}
export function billingDate(value: string): string {
  const date = value.slice(0,10)
  const [year,month,day] = date.split('-')
  return `${day}/${month}/${year}`
}
