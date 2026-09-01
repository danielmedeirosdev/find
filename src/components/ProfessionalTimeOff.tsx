import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate, formatTime } from '../lib/format'
import { InlineError } from './EmptyState'
import { userFacingError } from '../lib/userFacingError'
import { localDateIso } from '../lib/booking'
import type { Barber, BarberTimeOff } from '../lib/types'

interface Props {
  shopId: string
  barberId?: string
}

function todayIso() {
  return localDateIso()
}

export function ProfessionalTimeOff({ shopId, barberId }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [items, setItems] = useState<BarberTimeOff[]>([])
  const [selectedBarberId, setSelectedBarberId] = useState(barberId || '')
  const [startsOn, setStartsOn] = useState(todayIso())
  const [endsOn, setEndsOn] = useState(todayIso())
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('12:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: professionals, error: barberError }, { data: unavailable, error: timeOffError }] =
      await Promise.all([
        supabase.from('barbers').select('id, shop_id, name, photo_url, role').eq('shop_id', shopId).order('name'),
        supabase.from('barber_time_off').select('*').eq('shop_id', shopId).gte('ends_on', todayIso()).order('starts_on'),
      ])

    if (barberError || timeOffError) {
      setError(userFacingError(barberError || timeOffError, 'Não foi possível carregar as folgas.'))
      return
    }
    const list = (professionals as Barber[]) || []
    setBarbers(barberId ? list.filter((item) => item.id === barberId) : list)
    setItems((unavailable as BarberTimeOff[]) || [])
    setSelectedBarberId((current) => current || barberId || list[0]?.id || '')
  }, [shopId, barberId])

  useEffect(() => {
    load()
  }, [load])

  const names = useMemo(() => new Map(barbers.map((item) => [item.id, item.name])), [barbers])

  const save = async () => {
    setError('')
    if (!selectedBarberId || !startsOn || !endsOn) {
      setError('Escolha o profissional e o período da folga.')
      return
    }
    if (endsOn < startsOn) {
      setError('A data final não pode ser anterior à data inicial.')
      return
    }
    if (!allDay && endTime <= startTime) {
      setError('O horário final precisa ser posterior ao inicial.')
      return
    }

    setSaving(true)
    const { error: insertError } = await supabase.from('barber_time_off').insert({
      shop_id: shopId,
      barber_id: selectedBarberId,
      starts_on: startsOn,
      ends_on: endsOn,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
    })
    setSaving(false)
    if (insertError) {
      setError(userFacingError(insertError, 'Não foi possível salvar esta folga.'))
      return
    }
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm('Liberar novamente este período na agenda?')) return
    const { error: deleteError } = await supabase.from('barber_time_off').delete().eq('id', id)
    if (deleteError) {
      setError(userFacingError(deleteError, 'Não foi possível remover o bloqueio.'))
      return
    }
    await load()
  }

  return (
    <section className="rounded-2xl border border-charcoal-light bg-charcoal-dark/40 p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">Disponibilidade</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Folgas e bloqueios</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-charcoal-muted">
            Bloqueie um dia inteiro, férias ou apenas algumas horas. Esses períodos deixam de aparecer no agendamento online.
          </p>
        </div>
        <span className="rounded-full border border-brass/25 bg-brass/5 px-3 py-1 text-xs text-brass">
          {items.length} {items.length === 1 ? 'período futuro' : 'períodos futuros'}
        </span>
      </div>

      {error && <div className="mb-4"><InlineError message={error} /></div>}

      <div className="grid gap-3 lg:grid-cols-12">
        <label className="lg:col-span-3 text-xs font-medium text-charcoal-muted">
          Profissional
          <select value={selectedBarberId} onChange={(e) => setSelectedBarberId(e.target.value)} disabled={Boolean(barberId)} className="mt-1.5 min-h-11 w-full rounded-xl border border-charcoal-light bg-charcoal px-3 text-sm text-white outline-none focus:border-brass disabled:opacity-70">
            <option value="">Selecione</option>
            {barbers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="lg:col-span-2 text-xs font-medium text-charcoal-muted">
          Data inicial
          <input type="date" min={todayIso()} value={startsOn} onChange={(e) => { setStartsOn(e.target.value); if (e.target.value > endsOn) setEndsOn(e.target.value) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-charcoal-light bg-charcoal px-3 text-sm text-white outline-none focus:border-brass" />
        </label>
        <label className="lg:col-span-2 text-xs font-medium text-charcoal-muted">
          Data final
          <input type="date" min={startsOn} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-charcoal-light bg-charcoal px-3 text-sm text-white outline-none focus:border-brass" />
        </label>
        <div className="lg:col-span-5 flex items-end">
          <button type="button" onClick={save} disabled={saving} className="min-h-11 w-full rounded-xl bg-brass px-4 text-sm font-semibold text-charcoal transition hover:brightness-110 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Bloquear período'}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-charcoal-light/20 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[#d6a33d]" />
          Dia inteiro
        </label>
        {!allDay && (
          <>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-sm text-white" />
            <span className="text-xs text-charcoal-muted">até</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-sm text-white" />
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-light/80 bg-charcoal/60 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{names.get(item.barber_id) || 'Profissional'}</p>
                <p className="text-xs leading-5 text-charcoal-muted">
                  {formatDate(item.starts_on)}{item.ends_on !== item.starts_on ? ` até ${formatDate(item.ends_on)}` : ''}
                  {' · '}{item.start_time && item.end_time ? `${formatTime(item.start_time)}–${formatTime(item.end_time)}` : 'dia inteiro'}
                </p>
              </div>
              <button type="button" onClick={() => remove(item.id)} className="shrink-0 rounded-lg border border-red-400/25 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10">Remover</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
