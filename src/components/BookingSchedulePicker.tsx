import { useEffect, useRef, useState } from 'react'
import { availableBookingTimes, bookingClock, bookingNow, eligibleProfessionals, getActiveDays, getNextDatesForDay, loadBookingAvailability } from '../lib/booking'
import type { BookingAvailability } from '../lib/booking'
import { formatDuration } from '../lib/format'
import { DAY_NAMES } from '../lib/types'
import { TimeSlotGrid } from './TimeSlotGrid'

export interface BookingScheduleSelection {
  professionalId: string
  date: string
  time: string
}

interface Props {
  shopId: string
  professionals: { id: string; name: string }[]
  serviceIds: string[]
  duration: number
  value: BookingScheduleSelection
  onChange: (value: BookingScheduleSelection) => void
  onValidityChange: (valid: boolean) => void
  tone?: 'light' | 'dark'
  excludeBooking?: BookingScheduleSelection
}

/** Shared by public and internal booking: the same calendar, rules and slots. */
export function BookingSchedulePicker({ shopId, professionals, serviceIds, duration, value, onChange, onValidityChange, tone = 'light', excludeBooking }: Props) {
  const [availability, setAvailability] = useState<BookingAvailability | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [day, setDay] = useState<number | null>(value.date ? new Date(`${value.date}T12:00:00`).getDay() : null)
  const [now, setNow] = useState(() => new Date())
  // Parent callbacks can change identity without reloading the calendar.
  const callbacks = useRef({ onChange, onValidityChange })
  useEffect(() => { callbacks.current = { onChange, onValidityChange } }, [onChange, onValidityChange])
  const professionalKey = professionals.map(item => item.id).sort().join(',')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    callbacks.current.onValidityChange(false)
    loadBookingAvailability(shopId, professionalKey ? professionalKey.split(',') : [])
      .then(data => { if (active) { setAvailability(data); setNow(bookingNow(data.serverClock)) } })
      .catch(err => { if (active) { setAvailability(null); setError(err instanceof Error ? err.message : 'Não foi possível carregar os horários. Tente novamente.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, professionalKey, reload])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      setLoading(true)
      callbacks.current.onValidityChange(false)
      setReload(current => current + 1)
    }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  useEffect(() => {
    if (!availability?.serverClock) return
    const timer = window.setInterval(() => setNow(bookingNow(availability.serverClock)), 1000)
    return () => window.clearInterval(timer)
  }, [availability])

  const eligible = availability ? eligibleProfessionals(professionals, serviceIds, availability.mappings) : []
  const professionalIsEligible = eligible.some(item => item.id === value.professionalId)
  const schedules = availability?.schedules.filter(item => item.barber_id === value.professionalId) || []
  const activeDays = [...new Set(getActiveDays(schedules))]
  const calendar = availability && excludeBooking ? { ...availability, occupiedSlots: availability.occupiedSlots.filter(slot => !(slot.barber_id === excludeBooking.professionalId && slot.date === excludeBooking.date && slot.time.slice(0, 5) === excludeBooking.time.slice(0, 5))) } : availability
  const timesFor = (date: string) => calendar && professionalIsEligible ? availableBookingTimes(calendar, value.professionalId, date, duration, now) : []
  const dates = day === null ? [] : getNextDatesForDay(day, 12, bookingClock(now).date).filter(date => timesFor(date).length > 0).slice(0, 8)
  const slots = value.date ? timesFor(value.date) : []
  const valid = !loading && !error && professionalIsEligible && !!value.date && slots.includes(value.time)

  useEffect(() => { callbacks.current.onValidityChange(valid) }, [valid])
  const eligibleKey = eligible.map(item => item.id).join(',')
  const selectedTimeAvailable = slots.includes(value.time)
  useEffect(() => {
    if (loading || error || !availability) return
    if (!professionalIsEligible && (value.professionalId || value.date || value.time || eligibleKey.split(',').filter(Boolean).length === 1)) {
      callbacks.current.onChange({ professionalId: eligibleKey.split(',').filter(Boolean).length === 1 ? eligibleKey : '', date: '', time: '' })
      setDay(null)
    } else if (value.time && !selectedTimeAvailable) {
      callbacks.current.onChange({ ...value, time: '' })
    }
  }, [loading, error, availability, professionalIsEligible, eligibleKey, value, selectedTimeAvailable])

  const muted = tone === 'dark' ? 'text-charcoal-muted' : 'text-ink-muted'
  const text = tone === 'dark' ? 'text-white' : 'text-ink'
  const chip = (selected: boolean) => `min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors ${selected ? 'border-brass bg-brass text-charcoal font-semibold' : tone === 'dark' ? 'border-white/10 bg-charcoal text-white hover:border-brass/40' : 'border-transparent bg-paper text-ink hover:border-brass/40'}`
  return <div data-testid="booking-schedule-picker" className={`min-w-0 space-y-5 ${text}`} aria-busy={loading}>
    <p className={`text-sm ${muted}`}>Duração calculada: {formatDuration(duration)}</p>
    {loading ? <p role="status" className={`text-sm ${muted}`}>Carregando horários disponíveis...</p> : error ? <div role="alert" className="space-y-3"><p className="text-sm text-red-500">{error}</p><button type="button" className={chip(false)} onClick={() => setReload(current => current + 1)}>Tentar novamente</button></div> : <>
      <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium">Profissional</legend><div className="flex flex-wrap gap-2">
        {eligible.map(professional => <button type="button" key={professional.id} aria-pressed={value.professionalId === professional.id} className={`${chip(value.professionalId === professional.id)} max-w-full break-words`} onClick={() => { onChange({ professionalId: professional.id, date: '', time: '' }); setDay(null) }}>{professional.name}</button>)}
        {eligible.length === 0 && <p className={`text-sm ${muted}`}>Nenhum profissional atende essa combinação de serviços.</p>}
      </div></fieldset>
      {professionalIsEligible && <>
        {activeDays.length === 0 ? <p className={`text-sm ${muted}`}>Este profissional ainda não tem horários de trabalho configurados.</p> : <fieldset><legend className="mb-2 text-sm font-medium">Dia da semana</legend><div className="flex flex-wrap gap-2">{activeDays.map(weekday => <button key={weekday} type="button" aria-label={DAY_NAMES[weekday]} aria-pressed={day === weekday} className={chip(day === weekday)} onClick={() => { setDay(weekday); onChange({ ...value, date: '', time: '' }) }}>{DAY_NAMES[weekday].slice(0, 3)}</button>)}</div></fieldset>}
        {day !== null && <fieldset><legend className="mb-2 text-sm font-medium">Data</legend><div className="flex flex-wrap gap-2">{dates.map(date => <button key={date} type="button" data-date={date} aria-label={new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} aria-pressed={value.date === date} className={chip(value.date === date)} onClick={() => onChange({ ...value, date, time: '' })}><span className="block text-[11px] uppercase opacity-70">{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })}</span><span className="font-mono">{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span></button>)}{dates.length === 0 && <p className={`text-sm ${muted}`}>Nenhuma data disponível para esse dia nas próximas semanas. Escolha outro dia.</p>}</div></fieldset>}
        {value.date && <div><h3 className="mb-3 text-sm font-medium">Horários disponíveis</h3><TimeSlotGrid slots={slots} selected={value.time || null} onSelect={time => {
          const current = bookingNow(availability?.serverClock)
          setNow(current)
          onChange({ ...value, time: calendar && availableBookingTimes(calendar,value.professionalId,value.date,duration,current).includes(time) ? time : '' })
        }} tone={tone} emptyMessage="Nenhum horário com tempo suficiente nesta data. Escolha outra data." /></div>}
      </>}
    </>}
  </div>
}
