import { describe, expect, it } from 'vitest'
import { availableBookingTimes, bookingClock, bookingNow, eligibleProfessionals, getAvailableSlots, getNextDatesForDay, getShopClosureForDate, isShopClosedOnDate, localDateIso, type BookingAvailability } from '../booking'
import type { BarberSchedule, BarberTimeOff, Service, ShopClosure } from '../types'

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

const holiday: ShopClosure = {
  id: 'closure-1',
  shop_id: 'shop-1',
  starts_on: '2026-09-07',
  ends_on: '2026-09-08',
  label: 'Feriado nacional',
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

  it('reports the whole establishment closed during a configured holiday', () => {
    expect(
      isShopClosedOnDate([schedule], [], ['professional-1'], '2026-09-07', [holiday])
    ).toBe(true)
    expect(getShopClosureForDate([holiday], '2026-09-08')?.label).toBe('Feriado nacional')
  })

  it('removes every slot while the establishment is closed', () => {
    expect(
      getAvailableSlots(schedule, [], [service], '2026-09-07', undefined, [], [holiday])
    ).toEqual([])
  })

  it('keeps slots available after the closing period ends', () => {
    const laterHoliday = { ...holiday, starts_on: '2026-09-01', ends_on: '2026-09-06' }
    expect(
      getAvailableSlots(schedule, [], [service], '2026-09-07', undefined, [], [laterHoliday])
        .length
    ).toBeGreaterThan(0)
  })
})

describe('shared public and internal calendar', () => {
  const availability: BookingAvailability = { schedules: [schedule], occupiedSlots: [], timeOff: [], closures: [], mappings: [] }
  const now = new Date('2026-09-07T13:07:00Z') // 10:07 in São Paulo
  it('uses the establishment date even across UTC midnight', () => {
    expect(bookingClock(new Date('2026-09-08T01:30:00Z'))).toEqual({ date: '2026-09-07', time: '22:30' })
  })
  it('advances server time independently of the device clock', () => {
    const clock = { serverTime: Date.parse('2026-09-07T15:14:00Z'), measuredAt: 1000 }
    expect(bookingClock(bookingNow(clock, 2000))).toEqual({ date: '2026-09-07', time: '12:14' })
    expect(bookingClock(bookingNow(clock, 62000))).toEqual({ date: '2026-09-07', time: '12:15' })
    expect(bookingNow(clock, 0).toISOString()).toBe('2026-09-07T15:14:00.000Z')
  })
  it('removes a selected slot at the instant its starting minute is reached', () => {
    expect(availableBookingTimes(availability, 'professional-1', '2026-09-07', 15, new Date('2026-09-07T15:14:59Z'))).toContain('12:15')
    expect(availableBookingTimes(availability, 'professional-1', '2026-09-07', 15, new Date('2026-09-07T15:15:00Z'))).not.toContain('12:15')
  })
  it('offers only future slots with room for the complete duration', () => {
    const slots = availableBookingTimes(availability, 'professional-1', '2026-09-07', 90, now)
    expect(slots[0]).toBe('10:15')
    expect(slots[slots.length - 1]).toBe('11:30')
    expect(slots).not.toContain('10:00')
  })
  it('omits inactive weekdays and past dates', () => {
    expect(availableBookingTimes(availability, 'professional-1', '2026-09-06', 60, now)).toEqual([])
    expect(availableBookingTimes(availability, 'professional-1', '2026-09-08', 60, now)).toEqual([])
    expect(getAvailableSlots({ ...schedule, is_active: false }, [], [service], '2026-09-07')).toEqual([])
  })
  it('filters bookings by professional, not just date', () => {
    const slots = getAvailableSlots(schedule, [{ shop_id: 'shop-1', barber_id: 'other', date: '2026-09-07', time: '09:00', duration_minutes: 240 }], [service], '2026-09-07')
    expect(slots).toContain('09:00')
  })
  it('combines occupied time, partial leave and full closures', () => {
    const busy = { ...availability, occupiedSlots: [{ shop_id: 'shop-1', barber_id: 'professional-1', date: '2026-09-07', time: '10:30', duration_minutes: 60 }], timeOff: [timeOff({ starts_on: '2026-09-07', ends_on: '2026-09-07', start_time: '12:00', end_time: '13:00' })] }
    expect(availableBookingTimes(busy, 'professional-1', '2026-09-07', 60, now)).toEqual([])
    expect(availableBookingTimes({ ...availability, closures: [holiday] }, 'professional-1', '2026-09-07', 60, now)).toEqual([])
  })
  it('allows only professionals qualified for every selected service', () => {
    const team = [{ id: 'a' }, { id: 'b' }]
    const mappings = [{ service_id: 'bath', barber_id: 'a', shop_id: 'shop-1' }, { service_id: 'cut', barber_id: 'b', shop_id: 'shop-1' }]
    expect(eligibleProfessionals(team, ['unrestricted'], mappings)).toEqual(team)
    expect(eligibleProfessionals(team, ['bath'], mappings)).toEqual([{ id: 'a' }])
    expect(eligibleProfessionals(team, ['bath', 'cut'], mappings)).toEqual([])
  })
  it('uses the selected weekday for upcoming calendar dates', () => {
    expect(getNextDatesForDay(1, 2, '2026-09-08')).toEqual(['2026-09-14', '2026-09-21'])
  })
})
