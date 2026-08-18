import { timeToMinutes, minutesToTime } from './format'
import { supabase } from './supabase'
import type { BarberSchedule, PublicBookingSlot, Service } from './types'

export function bookingErrorMessage(err: unknown): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : typeof err === 'object' && err && 'message' in err
          ? String((err as { message: unknown }).message)
          : ''

  if (/bookings_barber_id_date_time|bookings_active_slot|duplicate key|unique constraint/i.test(message)) {
    return 'Esse horário acabou de ser reservado. Escolha outro horário.'
  }

  if (message.trim()) return message
  return 'Erro ao criar agendamento. Tente outro horário.'
}

/** Horários que ainda ocupam a agenda (alinhado a bookings_active_slot_uidx). */
export async function loadOccupiedSlots(shopId: string): Promise<PublicBookingSlot[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('public_booking_slots')
    .select('shop_id, barber_id, date, time, duration_minutes')
    .eq('shop_id', shopId)
    .gte('date', today)

  if (error) {
    throw new Error('Não foi possível carregar a agenda. Atualize a página e tente novamente.')
  }
  return (data as PublicBookingSlot[]) || []
}


const SLOT_INTERVAL = 15
const DEFAULT_SLOT_DURATION = 30

export function getTotalDuration(services: Service[]): number {
  return services.reduce((sum, s) => sum + s.duration_minutes, 0)
}

export function getTotalPrice(services: Service[]): number {
  return services.reduce((sum, s) => sum + Number(s.price), 0)
}

export function getActiveDays(schedules: BarberSchedule[]): number[] {
  return schedules
    .filter((s) => s.is_active)
    .map((s) => s.day_of_week)
    .sort((a, b) => a - b)
}

export function getScheduleForDay(
  schedules: BarberSchedule[],
  dayOfWeek: number
): BarberSchedule | undefined {
  return schedules.find((s) => s.day_of_week === dayOfWeek && s.is_active)
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && startB < endA
}

export function getAvailableSlots(
  schedule: BarberSchedule,
  occupiedSlots: PublicBookingSlot[],
  selectedServices: Service[],
  date: string,
  overrideDurationMinutes?: number
): string[] {
  const totalDuration =
    overrideDurationMinutes != null && overrideDurationMinutes > 0
      ? overrideDurationMinutes
      : getTotalDuration(selectedServices)
  if (totalDuration === 0) return []

  const daySlots = occupiedSlots.filter((s) => s.date === date)
  const workStart = timeToMinutes(schedule.start_time)
  const workEnd = timeToMinutes(schedule.end_time)

  const occupied: Array<{ start: number; end: number }> = daySlots.map((s) => {
    const start = timeToMinutes(s.time)
    const dur = s.duration_minutes && s.duration_minutes > 0 ? s.duration_minutes : DEFAULT_SLOT_DURATION
    return { start, end: start + dur }
  })

  const slots: string[] = []
  for (let t = workStart; t + totalDuration <= workEnd; t += SLOT_INTERVAL) {
    const slotEnd = t + totalDuration
    const hasConflict = occupied.some((o) => rangesOverlap(t, slotEnd, o.start, o.end))
    if (!hasConflict) {
      slots.push(minutesToTime(t))
    }
  }

  return slots
}

export function getNextDatesForDay(dayOfWeek: number, count = 8): string[] {
  const dates: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 60 && dates.length < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    if (d.getDay() === dayOfWeek) {
      dates.push(d.toISOString().slice(0, 10))
    }
  }
  return dates
}
