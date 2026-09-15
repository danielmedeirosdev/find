import { describe, expect, it } from 'vitest'
import { durationPayload, getPetServicesDuration, getPetServicesPrice } from '../pet'
import { getAvailableSlots, getTotalDuration } from '../booking'
import type { Service, ServiceSizeRule, BarberSchedule } from '../types'

// Isolated test fixtures only; never persisted to Supabase.
const service: Service = { id: 's1', shop_id: 'a', name: 'Test service', price: 80, duration_minutes: 45 }
const rules: ServiceSizeRule[] = [
  { id: 'r1', service_id: 's1', size: 'pequeno', duration_minutes: 45, price: null },
  { id: 'r2', service_id: 's1', size: 'medio', duration_minutes: 75, price: 95 },
  { id: 'r3', service_id: 's1', size: 'grande', duration_minutes: 105, price: null },
]
const schedule: BarberSchedule = { id: 'h', barber_id: 'b', day_of_week: 1, is_active: true, start_time: '09:00', end_time: '13:00' }

describe('owner configured PET duration', () => {
  it('preserves legacy single duration without rules', () => {
    for (const size of ['pequeno', 'medio', 'grande'] as const) expect(getPetServicesDuration([service], size, [])).toBe(45)
  })
  it('requires explicit new single duration and does not seed rules', () => {
    expect(() => durationPayload({ mode: 'single', minutes: '', sizes: {} })).toThrow()
    expect(durationPayload({ mode: 'single', minutes: '47', sizes: {} })).toEqual({ p_duration_minutes: 47, p_size_durations: null })
  })
  it('requires every size and preserves the owner values exactly', () => {
    expect(() => durationPayload({ mode: 'size', minutes: '', sizes: { pequeno: '45' } })).toThrow()
    expect(durationPayload({ mode: 'size', minutes: '', sizes: { pequeno: '45', medio: '75', grande: '105' } }).p_size_durations).toEqual({ pequeno: 45, medio: 75, grande: 105 })
  })
  it.each(['0', '-1', 'NaN', '45.5', '721'])('rejects invalid duration %s without fallback', (minutes) => {
    expect(() => durationPayload({ mode: 'single', minutes, sizes: {} })).toThrow()
  })
  it('uses different durations for the same service and different pets', () => {
    expect(getPetServicesDuration([service], 'pequeno', rules)).toBe(45)
    expect(getPetServicesDuration([service], 'medio', rules)).toBe(75)
    expect(getPetServicesDuration([service], 'grande', rules)).toBe(105)
  })
  it('does not use another service rules', () => {
    expect(getPetServicesDuration([{ ...service, id: 'another' }], 'medio', rules)).toBe(45)
  })
  it('keeps existing partial rules compatible', () => {
    expect(getPetServicesDuration([service], 'grande', rules.slice(0, 1))).toBe(45)
  })
  it('blocks the calculated interval including partial overlaps and permits adjacent slots', () => {
    const occupied = [{ shop_id: 'a', barber_id: 'b', date: '2026-10-05', time: '10:15', duration_minutes: 75 }]
    const slots = getAvailableSlots(schedule, occupied, [service], '2026-10-05', getPetServicesDuration([service], 'medio', rules))
    expect(slots).toContain('09:00')
    expect(slots).not.toContain('09:15')
    expect(slots).not.toContain('11:15')
    expect(slots).toContain('11:30')
    expect(slots).not.toContain('12:00')
  })
  it('preserves prices and barbershop duration calculation', () => {
    expect(getPetServicesPrice([service], 'medio', rules)).toBe(95)
    expect(getTotalDuration([service])).toBe(45)
  })
})
