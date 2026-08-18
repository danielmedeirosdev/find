import { describe, expect, it } from 'vitest'
import { decideApplyPath } from '../asaas-billing'

describe('asaas referral apply path (billing + referral regression)', () => {
  it('refuses overdue shops with asaas subscription', () => {
    expect(
      decideApplyPath({
        subscription_status: 'blocked',
        asaas_customer_id: 'cus_1',
        asaas_subscription_id: 'sub_1',
      })
    ).toBe('overdue_refuse')
  })

  it('postpones active asaas subscriptions', () => {
    expect(
      decideApplyPath({
        subscription_status: 'active',
        asaas_customer_id: 'cus_1',
        asaas_subscription_id: 'sub_1',
      })
    ).toBe('asaas_postpone')
  })

  it('extends trial when there is no asaas subscription', () => {
    expect(
      decideApplyPath({
        subscription_status: 'trial',
        asaas_customer_id: null,
        asaas_subscription_id: null,
      })
    ).toBe('trial_extension')
  })
})
