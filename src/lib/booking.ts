import { timeToMinutes, minutesToTime } from './format'
import { supabase } from './supabase'
import type { BarberSchedule, BarberTimeOff, PublicBookingSlot, Service, ServiceBarber, ShopClosure } from './types'

export function localDateIso(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
export async function loadOccupiedSlots(shopId: string, today = bookingClock().date): Promise<PublicBookingSlot[]> {
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

export async function loadPublicTimeOff(shopId: string, today = bookingClock().date): Promise<BarberTimeOff[]> {
  const { data, error } = await supabase
    .from('barber_time_off')
    .select('id, shop_id, barber_id, starts_on, ends_on, start_time, end_time')
    .eq('shop_id', shopId)
    .gte('ends_on', today)

  if (error) {
    throw new Error('Não foi possível carregar as folgas da equipe. Atualize a página e tente novamente.')
  }
  return (data as BarberTimeOff[]) || []
}

export async function loadPublicShopClosures(shopId: string, today = bookingClock().date): Promise<ShopClosure[]> {
  const { data, error } = await supabase
    .from('shop_closures')
    .select('id, shop_id, starts_on, ends_on, label')
    .eq('shop_id', shopId)
    .gte('ends_on', today)
    .order('starts_on')

  if (error) {
    throw new Error('Não foi possível carregar os dias de fechamento. Tente novamente.')
  }
  return (data as ShopClosure[]) || []
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
  overrideDurationMinutes?: number,
  timeOff: BarberTimeOff[] = [],
  shopClosures: ShopClosure[] = []
): string[] {
  const totalDuration =
    overrideDurationMinutes != null && overrideDurationMinutes > 0
      ? overrideDurationMinutes
      : getTotalDuration(selectedServices)
  if (!schedule.is_active || totalDuration <= 0 || getShopClosureForDate(shopClosures, date)) return []

  const daySlots = occupiedSlots.filter((s) => s.date === date && s.barber_id === schedule.barber_id)
  const workStart = timeToMinutes(schedule.start_time)
  const workEnd = timeToMinutes(schedule.end_time)

  const occupied: Array<{ start: number; end: number }> = daySlots.map((s) => {
    const start = timeToMinutes(s.time)
    const dur = s.duration_minutes && s.duration_minutes > 0 ? s.duration_minutes : DEFAULT_SLOT_DURATION
    return { start, end: start + dur }
  })

  const blocked: Array<{ start: number; end: number }> = timeOff
    .filter((item) => item.barber_id === schedule.barber_id && date >= item.starts_on && date <= item.ends_on)
    .map((item) => ({
      start: item.start_time ? timeToMinutes(item.start_time) : 0,
      end: item.end_time ? timeToMinutes(item.end_time) : 24 * 60,
    }))

  const slots: string[] = []
  for (let t = workStart; t + totalDuration <= workEnd; t += SLOT_INTERVAL) {
    const slotEnd = t + totalDuration
    const hasConflict = [...occupied, ...blocked].some((o) =>
      rangesOverlap(t, slotEnd, o.start, o.end)
    )
    if (!hasConflict) {
      slots.push(minutesToTime(t))
    }
  }

  return slots
}

export function getNextDatesForDay(dayOfWeek: number, count = 8, from = bookingClock().date): string[] {
  const dates: string[] = []
  const today = new Date(`${from}T12:00:00`)
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 60 && dates.length < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    if (d.getDay() === dayOfWeek) {
      dates.push(localDateIso(d))
    }
  }
  return dates
}

/** The establishment's calendar, matching the server's booking timezone. */
export function bookingClock(now = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: string) => parts.find(item => item.type === type)!.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}

export function eligibleProfessionals<T extends { id: string }>(
  professionals: T[], serviceIds: string[], mappings: ServiceBarber[]
): T[] {
  return professionals.filter(professional => serviceIds.every(serviceId => {
    const assigned = mappings.filter(mapping => mapping.service_id === serviceId)
    return assigned.length === 0 || assigned.some(mapping => mapping.barber_id === professional.id)
  }))
}

export interface BookingAvailability {
  serverClock?: { serverTime: number; measuredAt: number }
  schedules: BarberSchedule[]
  occupiedSlots: PublicBookingSlot[]
  timeOff: BarberTimeOff[]
  closures: ShopClosure[]
  mappings: ServiceBarber[]
}

/** Advance the server clock using monotonic elapsed time, independent of device date settings. */
export function bookingNow(clock?: BookingAvailability['serverClock'], elapsed = performance.now()): Date {
  return clock ? new Date(clock.serverTime + Math.max(0, elapsed - clock.measuredAt)) : new Date()
}

export async function loadBookingAvailability(shopId: string, professionalIds: string[]): Promise<BookingAvailability> {
  const startedAt = performance.now()
  const clockResult = await supabase.rpc('current_booking_time')
  const receivedAt = performance.now()
  const serverTime = typeof clockResult.data === 'string' ? Date.parse(clockResult.data) : NaN
  if (clockResult.error || !Number.isFinite(serverTime)) throw new Error('Não foi possível conferir a hora atual do agendamento. Tente novamente.')
  // Include request transit time conservatively: a slot must disappear before
  // it can be rejected as elapsed, even with a slow network or a wrong device clock.
  const serverClock = { serverTime: serverTime + receivedAt - startedAt, measuredAt: receivedAt }
  const today = bookingClock(bookingNow(serverClock)).date
  const [scheduleResult, mappingResult, occupiedSlots, timeOff, closures] = await Promise.all([
    professionalIds.length ? supabase.from('barber_schedule').select('*').in('barber_id', professionalIds) : Promise.resolve({ data: [], error: null }),
    supabase.from('service_barbers').select('*').eq('shop_id', shopId),
    loadOccupiedSlots(shopId, today), loadPublicTimeOff(shopId, today), loadPublicShopClosures(shopId, today),
  ])
  if (scheduleResult.error || mappingResult.error) throw new Error('Não foi possível carregar a disponibilidade da equipe. Tente novamente.')
  return { serverClock, schedules: scheduleResult.data || [], mappings: mappingResult.data || [], occupiedSlots, timeOff, closures }
}

export function availableBookingTimes(
  availability: BookingAvailability, professionalId: string, date: string, duration: number, now = bookingNow(availability.serverClock)
): string[] {
  const clock = bookingClock(now)
  if (date < clock.date) return []
  const schedule = getScheduleForDay(availability.schedules.filter(s => s.barber_id === professionalId), new Date(`${date}T12:00:00`).getDay())
  if (!schedule) return []
  return getAvailableSlots(schedule, availability.occupiedSlots, [], date, duration, availability.timeOff, availability.closures)
    .filter(time => date > clock.date || time > clock.time)
}

export function isShopClosedOnDate(
  schedules: BarberSchedule[],
  timeOff: BarberTimeOff[],
  barberIds: string[],
  date: string,
  shopClosures: ShopClosure[] = []
): boolean {
  if (getShopClosureForDate(shopClosures, date)) return true
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay()
  const activeProfessionals = new Set(
    schedules
      .filter((schedule) => schedule.is_active && schedule.day_of_week === dayOfWeek && barberIds.includes(schedule.barber_id))
      .map((schedule) => schedule.barber_id)
  )
  if (activeProfessionals.size === 0) return true

  return Array.from(activeProfessionals).every((professionalId) =>
    timeOff.some(
      (item) =>
        item.barber_id === professionalId &&
        date >= item.starts_on &&
        date <= item.ends_on &&
        item.start_time === null &&
        item.end_time === null
    )
  )
}

export function getShopClosureForDate(
  shopClosures: ShopClosure[],
  date: string
): ShopClosure | undefined {
  return shopClosures.find((item) => date >= item.starts_on && date <= item.ends_on)
}
