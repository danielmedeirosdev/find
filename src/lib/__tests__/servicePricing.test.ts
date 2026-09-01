import { describe, expect, it } from 'vitest'
import { applyWeekdayDiscount, customAnswersExtra, petTransportFee } from '../servicePricing'
import type { ServiceCustomFieldOption, ServicePetTransport, ServiceWeekdayDiscount } from '../types'

describe('service pricing', () => {
  it('applies only the discount configured for the service and weekday', () => {
    const discounts: ServiceWeekdayDiscount[] = [
      { shop_id: 'shop-1', service_id: 'service-1', day_of_week: 1, discount_percent: 15 },
    ]

    expect(applyWeekdayDiscount(100, 'service-1', '2026-09-07', discounts)).toBe(85)
    expect(applyWeekdayDiscount(100, 'service-2', '2026-09-07', discounts)).toBe(100)
    expect(applyWeekdayDiscount(100, 'service-1', '2026-09-08', discounts)).toBe(100)
  })

  it('adds only selected custom option prices', () => {
    const options: ServiceCustomFieldOption[] = [
      { id: 'short', field_id: 'coat', shop_id: 'shop-1', label: 'Curto', price_delta: 0, sort_order: 0 },
      { id: 'long', field_id: 'coat', shop_id: 'shop-1', label: 'Longo', price_delta: 18.5, sort_order: 1 },
    ]

    expect(customAnswersExtra([{ field_id: 'coat', option_id: 'long', value: null }], options)).toBe(18.5)
    expect(customAnswersExtra([{ field_id: 'coat', option_id: 'missing', value: null }], options)).toBe(0)
  })

  it('charges taxi pet once using the highest enabled fee among selected services', () => {
    const transport: ServicePetTransport[] = [
      { shop_id: 'shop-1', service_id: 'service-1', enabled: true, fee: 12, pricing_mode: 'fixed' },
      { shop_id: 'shop-1', service_id: 'service-2', enabled: true, fee: 20, pricing_mode: 'fixed' },
      { shop_id: 'shop-1', service_id: 'service-3', enabled: false, fee: 30, pricing_mode: 'fixed' },
    ]

    expect(petTransportFee(new Set(['service-1', 'service-2', 'service-3']), transport)).toBe(20)
    expect(petTransportFee(new Set(['service-3']), transport)).toBe(0)
  })

  it('leaves taxi pet out of the quote when the fee depends on the address', () => {
    const transport: ServicePetTransport[] = [
      { shop_id: 'shop-1', service_id: 'service-1', enabled: true, fee: 0, pricing_mode: 'quote' },
    ]

    expect(petTransportFee(new Set(['service-1']), transport)).toBe(0)
  })
})
