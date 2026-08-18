export type SubscriptionStatus = 'trial' | 'active' | 'blocked'

export type ApplyPath =
  | 'overdue_refuse'
  | 'asaas_postpone'
  | 'trial_extension'
  | 'missing_subscription'

export type ShopBillingSnapshot = {
  subscription_status: SubscriptionStatus
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
}

export function decideApplyPath(shop: ShopBillingSnapshot): ApplyPath {
  const hasSub = Boolean(shop.asaas_subscription_id)
  if (shop.subscription_status === 'blocked' && hasSub) return 'overdue_refuse'
  if (hasSub) return 'asaas_postpone'
  if (shop.subscription_status === 'active') {
    return shop.asaas_customer_id ? 'asaas_postpone' : 'missing_subscription'
  }
  return 'trial_extension'
}

export function addCalendarMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)
  ).getUTCDate()
  shifted.setUTCDate(Math.min(day, lastDay))
  return shifted.toISOString().slice(0, 10)
}

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function computePostponedDueDate(
  currentNextDue: string | null,
  months: number,
  todayIso: string
): string {
  const tomorrow = addDaysIso(todayIso, 1)
  const base = currentNextDue && currentNextDue > tomorrow ? currentNextDue : tomorrow
  return addCalendarMonths(base, months)
}

export function nextDueFromComplimentary(
  complimentaryUntil: string | null | undefined,
  tomorrowIso: string
): string {
  if (!complimentaryUntil) return tomorrowIso
  const date = complimentaryUntil.slice(0, 10)
  return date > tomorrowIso ? date : tomorrowIso
}

export function isPendingPaymentStatus(status: string | undefined | null): boolean {
  return status === 'PENDING'
}

export function parseAsaasError(body: unknown, httpStatus: number): string {
  if (body && typeof body === 'object' && 'errors' in body) {
    const errors = (body as { errors?: Array<{ description?: string }> }).errors
    const desc = errors?.map((item) => item.description).filter(Boolean).join('; ')
    if (desc) return desc
  }
  if (httpStatus === 0) return 'Asaas timeout'
  return `Asaas HTTP ${httpStatus}`
}

export function isUnexpectedSubscription(body: unknown): boolean {
  if (!body || typeof body !== 'object') return true
  const id = (body as { id?: unknown }).id
  return typeof id !== 'string' || id.length < 3
}

export function pickActiveSubscription<T extends { id?: string; status?: string }>(
  storedId: string | null,
  items: T[]
): T | null {
  const active = items.filter((item) => item.status === 'ACTIVE' && typeof item.id === 'string')
  if (storedId) {
    const match = active.find((item) => item.id === storedId)
    if (match) return match
  }
  return active[0] ?? null
}

export function assertAsaasBillingHelpers(): void {
  const cases: Array<[boolean, string]> = [
    [addCalendarMonths('2026-01-31', 1) === '2026-02-28', 'jan 31 + 1 month'],
    [addCalendarMonths('2026-01-15', 3) === '2026-04-15', 'three months'],
    [computePostponedDueDate('2026-08-10', 1, '2026-08-18') === '2026-09-19', 'past due uses tomorrow'],
    [computePostponedDueDate('2026-10-05', 1, '2026-08-18') === '2026-11-05', 'future due plus month'],
    [computePostponedDueDate('2026-10-05', 3, '2026-08-18') === '2027-01-05', 'three months on existing due'],
    [nextDueFromComplimentary('2026-12-01T12:00:00Z', '2026-08-19') === '2026-12-01', 'complimentary wins'],
    [nextDueFromComplimentary('2026-08-10T12:00:00Z', '2026-08-19') === '2026-08-19', 'past complimentary ignored'],
    [isPendingPaymentStatus('PENDING') === true, 'pending true'],
    [isPendingPaymentStatus('OVERDUE') === false, 'overdue not pending'],
    [isPendingPaymentStatus('CONFIRMED') === false, 'confirmed not pending'],
    [parseAsaasError({ errors: [{ description: 'timeout' }] }, 500) === 'timeout', 'asaas errors'],
    [parseAsaasError({}, 0) === 'Asaas timeout', 'timeout status'],
    [isUnexpectedSubscription({}) === true, 'empty body unexpected'],
    [isUnexpectedSubscription({ id: 'sub_123' }) === false, 'id expected'],
    [
      decideApplyPath({
        subscription_status: 'blocked',
        asaas_customer_id: 'cus_1',
        asaas_subscription_id: 'sub_1',
      }) === 'overdue_refuse',
      'blocked with asaas refuses',
    ],
    [
      decideApplyPath({
        subscription_status: 'trial',
        asaas_customer_id: null,
        asaas_subscription_id: null,
      }) === 'trial_extension',
      'trial without asaas extends trial',
    ],
    [
      decideApplyPath({
        subscription_status: 'active',
        asaas_customer_id: 'cus_1',
        asaas_subscription_id: 'sub_1',
      }) === 'asaas_postpone',
      'active postpones',
    ],
    [
      decideApplyPath({
        subscription_status: 'active',
        asaas_customer_id: null,
        asaas_subscription_id: null,
      }) === 'missing_subscription',
      'active without asaas is missing',
    ],
    [
      decideApplyPath({
        subscription_status: 'blocked',
        asaas_customer_id: null,
        asaas_subscription_id: null,
      }) === 'trial_extension',
      'expired trial can extend',
    ],
    [
      pickActiveSubscription('sub_b', [
        { id: 'sub_a', status: 'DELETED' },
        { id: 'sub_b', status: 'ACTIVE' },
      ])?.id === 'sub_b',
      'picks stored active',
    ],
    [pickActiveSubscription(null, [{ id: 'sub_x', status: 'INACTIVE' }]) === null, 'no active'],
  ]

  const failed = cases.filter(([ok]) => !ok).map(([, label]) => label)
  if (failed.length > 0) {
    throw new Error(`asaas-billing self-test failed: ${failed.join(', ')}`)
  }
}
