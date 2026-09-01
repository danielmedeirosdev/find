import { describe, expect, it } from 'vitest'
import { getAvailableSlots, isShopClosedOnDate, localDateIso } from '../booking'
import type { BarberSchedule, BarberTimeOff, Service } from '../types'

const schedule: BarberSchedule = {
  id: 'schedule-1',
  barber_id: 'professional-1',
  day_of_week: 1,
  is_active: true,
  start_time: '09:00',
  end_time: '13:00',
}

const service: Service = {
  id: 'service-1',
  shop_id: 'shop-1',
  name: 'Banho',
  price: 70,
  duration_minutes: 60,
}

function timeOff(overrides: Partial<BarberTimeOff>): BarberTimeOff {
  return {
    id: 'time-off-1',
    shop_id: 'shop-1',
    barber_id: 'professional-1',
    starts_on: '2026-09-02',
    ends_on: '2026-09-02',
    start_time: null,
    end_time: null,
    ...overrides,
  }
}

describe('professional time off availability', () => {
  it('removes every slot on a full day off', () => {
    expect(
      getAvailableSlots(schedule, [], [service], '2026-09-02', undefined, [timeOff({})])
    ).toEqual([])
  })

  it('removes slots that overlap a partial block', () => {
    const slots = getAvailableSlots(schedule, [], [service], '2026-09-02', undefined, [
      timeOff({ start_time: '10:00', end_time: '11:30' }),
    ])

    expect(slots).toContain('09:00')
    expect(slots).not.toContain('09:15')
    expect(slots).not.toContain('10:30')
    expect(slots).toContain('11:30')
  })

  it('does not block another professional', () => {
    const slots = getAvailableSlots(schedule, [], [service], '2026-09-02', undefined, [
      timeOff({ barber_id: 'professional-2' }),
    ])
    expect(slots.length).toBeGreaterThan(0)
  })
})

describe('shop open state', () => {
  it('formats dates using local calendar fields', () => {
    expect(localDateIso(new Date(2026, 8, 7, 23, 30))).toBe('2026-09-07')
  })

  it('reports closed when nobody works that weekday', () => {
    expect(isShopClosedOnDate([schedule], [], ['professional-1'], '2026-09-06')).toBe(true)
  })

  it('reports open when at least one professional works and is available', () => {
    expect(isShopClosedOnDate([schedule], [], ['professional-1'], '2026-09-07')).toBe(false)
  })

  it('reports closed when every scheduled professional has a full-day block', () => {
    expect(
      isShopClosedOnDate([schedule], [timeOff({ starts_on: '2026-09-07', ends_on: '2026-09-07' })], ['professional-1'], '2026-09-07')
    ).toBe(true)
  })
})
