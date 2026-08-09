import { timeToMinutes, minutesToTime } from './format'
import type { BarberSchedule, PublicBookingSlot, Service } from './types'

export function bookingErrorMessage(err: unknown): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : ''

  if (/bookings_barber_id_date_time|bookings_active_slot|duplicate key|unique constraint/i.test(message)) {
    return 'Esse horário acabou de ser reservado. Escolha outro horário.'
  }

  if (message.trim()) return message
  return 'Erro ao criar agendamento. Tente outro horário.'
}


const SLOT_INTERVAL = 15

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

const DEFAULT_SLOT_DURATION = 30

export function getAvailableSlots(
  schedule: BarberSchedule,
  occupiedSlots: PublicBookingSlot[],
  selectedServices: Service[],
  date: string
): string[] {
  const totalDuration = getTotalDuration(selectedServices)
  if (totalDuration === 0) return []

  const daySlots = occupiedSlots.filter((s) => s.date === date)
  const workStart = timeToMinutes(schedule.start_time)
  const workEnd = timeToMinutes(schedule.end_time)

  const occupied: Array<{ start: number; end: number }> = daySlots.map((s) => {
    const start = timeToMinutes(s.time)
    return { start, end: start + DEFAULT_SLOT_DURATION }
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
