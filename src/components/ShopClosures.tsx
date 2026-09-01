import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import { localDateIso } from '../lib/booking'
import { userFacingError } from '../lib/userFacingError'
import { AppIcon } from './AppIcon'
import { InlineError } from './EmptyState'
import type { ShopClosure } from '../lib/types'

interface Props {
  shopId: string
}

const ACTIVE_BOOKING_STATUSES = ['scheduled', 'confirmed', 'in_progress', 'awaiting_payment']

export function ShopClosures({ shopId }: Props) {
  const today = localDateIso()
  const [items, setItems] = useState<ShopClosure[]>([])
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(today)
  const [label, setLabel] = useState('Feriado')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('shop_closures')
      .select('id, shop_id, starts_on, ends_on, label, created_at')
      .eq('shop_id', shopId)
      .gte('ends_on', today)
      .order('starts_on')

    if (loadError) {
      setError(userFacingError(loadError, 'Não foi possível carregar os fechamentos.'))
      return
    }
    setItems((data as ShopClosure[]) || [])
  }, [shopId, today])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    setError('')
    setNotice('')
    const cleanLabel = label.trim()
    if (!startsOn || !endsOn || !cleanLabel) {
      setError('Informe o período e o motivo do fechamento.')
      return
    }
    if (endsOn < startsOn) {
      setError('A data final não pode ser anterior à data inicial.')
      return
    }
    if (cleanLabel.length > 120) {
      setError('O motivo deve ter no máximo 120 caracteres.')
      return
    }

    setSaving(true)
    const [{ error: insertError }, { count: existingBookings }] = await Promise.all([
      supabase.from('shop_closures').insert({
        shop_id: shopId,
        starts_on: startsOn,
        ends_on: endsOn,
        label: cleanLabel,
      }),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .gte('date', startsOn)
        .lte('date', endsOn)
        .in('status', ACTIVE_BOOKING_STATUSES),
    ])
    setSaving(false)

    if (insertError) {
      setError(userFacingError(insertError, 'Não foi possível salvar este fechamento.'))
      return
    }

    setNotice(
      existingBookings
        ? `Fechamento salvo. Existem ${existingBookings} agendamento(s) nesse período; eles não foram cancelados automaticamente.`
        : 'Fechamento salvo. Novos agendamentos foram bloqueados nesse período.',
    )
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm('Reabrir o estabelecimento neste período?')) return
    const { error: deleteError } = await supabase.from('shop_closures').delete().eq('id', id)
    if (deleteError) {
      setError(userFacingError(deleteError, 'Não foi possível remover o fechamento.'))
      return
    }
    setNotice('Período reaberto para novos agendamentos.')
    await load()
  }

  return (
    <section className="rounded-2xl border border-brass/25 bg-brass/5 p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brass/10 text-brass">
            <AppIcon name="store" size={20} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">Estabelecimento</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Feriados e fechamentos</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-charcoal-muted">
              Feche toda a agenda em feriados, recessos ou manutenção. Folgas individuais continuam na seção da equipe.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-brass/10 px-3 py-1 text-xs text-brass">
          {items.length} {items.length === 1 ? 'período futuro' : 'períodos futuros'}
        </span>
      </div>

      {error ? <div className="mb-4"><InlineError message={error} /></div> : null}
      {notice ? (
        <p role="status" className="mb-4 rounded-xl border border-brass/20 bg-charcoal/40 px-4 py-3 text-sm leading-6 text-brass-light">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-12">
        <label className="text-xs font-medium text-charcoal-muted lg:col-span-4">
          Motivo mostrado ao cliente
          <input value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} placeholder="Ex: Feriado nacional" className="mt-1.5 min-h-11 w-full rounded-xl border border-charcoal-light bg-charcoal px-3 text-sm text-white outline-none placeholder:text-charcoal-muted/60 focus:border-brass" />
        </label>
        <label className="text-xs font-medium text-charcoal-muted lg:col-span-2">
          Primeiro dia fechado
          <input type="date" min={today} value={startsOn} onChange={(event) => { setStartsOn(event.target.value); if (event.target.value > endsOn) setEndsOn(event.target.value) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-charcoal-light bg-charcoal px-3 text-sm text-white outline-none focus:border-brass" />
        </label>
        <label className="text-xs font-medium text-charcoal-muted lg:col-span-2">
          Último dia fechado
          <input type="date" min={startsOn} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-charcoal-light bg-charcoal px-3 text-sm text-white outline-none focus:border-brass" />
        </label>
        <div className="flex items-end lg:col-span-4">
          <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brass px-4 text-sm font-semibold text-charcoal transition hover:brightness-110 disabled:opacity-50">
            <AppIcon name="calendar-off" size={17} />
            {saving ? 'Salvando...' : 'Fechar estabelecimento'}
          </button>
        </div>
      </div>

      {items.length ? (
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-light/80 bg-charcoal/60 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs leading-5 text-charcoal-muted">
                  {formatDate(item.starts_on)}{item.ends_on !== item.starts_on ? ` até ${formatDate(item.ends_on)}` : ''}
                  {' · estabelecimento fechado'}
                </p>
              </div>
              <button type="button" onClick={() => remove(item.id)} className="shrink-0 rounded-lg px-3 py-2 text-xs text-red-300 transition hover:bg-red-400/10">Reabrir</button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
