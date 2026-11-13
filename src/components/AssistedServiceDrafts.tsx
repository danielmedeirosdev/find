import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

interface Draft { id: string; name: string }

export function AssistedServiceDrafts({ shopId, onConfirmed }: { shopId: string; onConfirmed: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [selected, setSelected] = useState<Draft | null>(null)
  const [price, setPrice] = useState('')
  const [minutes, setMinutes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const [services, setup] = await Promise.all([
      supabase.from('assisted_service_drafts').select('id,name').eq('shop_id', shopId).order('name'),
      supabase.from('assisted_shop_setup').select('pending_notes').eq('shop_id', shopId).maybeSingle(),
    ])
    if (services.error || setup.error) { setError('Não foi possível consultar as pendências.'); return }
    setDrafts(services.data || [])
    setNotes((setup.data?.pending_notes || []).filter((note: unknown): note is string => typeof note === 'string'))
  }, [shopId])
  useEffect(() => { void load() }, [load])

  async function confirmService(event: FormEvent) {
    event.preventDefault()
    if (!selected || saving) return
    const amount = Number(price.replace(',', '.')), duration = Number(minutes)
    if (!price.trim() || !minutes.trim() || !Number.isFinite(amount) || amount < 0 || !Number.isInteger(duration) || duration < 1 || duration > 720) {
      setError('Informe o preço real e a duração de 1 a 720 minutos.'); return
    }
    setSaving(true); setError('')
    try {
      const result = await supabase.rpc('confirm_assisted_service', { p_draft_id: selected.id, p_price: amount, p_duration: duration })
      if (result.error) throw result.error
      setSelected(null); setPrice(''); setMinutes('')
      await load(); onConfirmed()
    } catch { setError('Não foi possível confirmar o serviço. Tente novamente.') }
    finally { setSaving(false) }
  }

  if (!drafts.length && !notes.length && !error) return null
  return <section aria-labelledby="assisted-pending-heading" className="mb-6 rounded-xl border border-charcoal-light bg-charcoal p-4 sm:p-5">
    <h3 id="assisted-pending-heading" className="text-lg font-semibold text-white">Complete sua configuração</h3>
    {notes.length > 0 && <details className="mt-3 text-sm text-charcoal-muted"><summary className="min-h-11 cursor-pointer py-3 text-white">Informações para conferir</summary><ul className="list-disc space-y-2 pl-5">{notes.map(note => <li key={note}>{note}</li>)}</ul></details>}
    {drafts.length > 0 && <><p className="mt-2 text-sm leading-6 text-charcoal-muted">Estes serviços já foram identificados. Confirme preço e duração para oferecê-los nos agendamentos.</p>
      <ul className="mt-3 divide-y divide-charcoal-light">{drafts.map(draft => <li key={draft.id} className="flex items-center justify-between gap-3 py-2"><span className="text-sm text-white">{draft.name}</span><button type="button" disabled={saving} onClick={() => { setSelected(draft); setPrice(''); setMinutes(''); setError('') }} className="min-h-11 shrink-0 px-2 text-sm text-brass underline underline-offset-4 disabled:opacity-50">Completar<span className="sr-only"> {draft.name}</span></button></li>)}</ul></>}
    {selected && <form onSubmit={confirmService} className="mt-4 space-y-3 border-t border-charcoal-light pt-4">
      <p className="font-medium text-white">{selected.name}</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-white">Preço (R$)<input required inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal-dark px-3" /></label>
      <label className="text-sm text-white">Duração (minutos)<input required type="number" min="1" max="720" step="1" value={minutes} onChange={event => setMinutes(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal-dark px-3" /></label></div>
      <div className="flex flex-wrap gap-3"><button disabled={saving} className="min-h-11 rounded-lg bg-brass px-4 text-sm font-semibold text-charcoal disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar serviço'}</button><button type="button" disabled={saving} onClick={() => setSelected(null)} className="min-h-11 px-3 text-sm text-white">Cancelar</button></div>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
  </section>
}
