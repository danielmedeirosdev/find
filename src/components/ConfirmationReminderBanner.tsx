import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
type Reminder = { id: string; booking_id: string; body: string }
interface Props { shopId: string; refreshKey: number; onPendingChange: (ids: string[]) => void; onOpen: (bookingId: string) => void }
export function ConfirmationReminderBanner({ shopId, refreshKey, onPendingChange, onOpen }: Props) {
  const [items, setItems] = useState<Reminder[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error: loadError } = await supabase.rpc('get_pending_confirmation_reminders', { p_shop_id: shopId })
      if (!active) return
      setError(Boolean(loadError))
      if (!loadError) { const list = (data || []) as Reminder[]; setItems(list); onPendingChange(list.map(item => item.booking_id)) }
    }
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    const focus = () => void load()
    window.addEventListener('focus', focus)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [shopId, refreshKey, onPendingChange])
  if (!items.length) return error ? <p role="alert" className="mb-4 text-xs text-charcoal-muted">Não foi possível conferir os lembretes agora. A próxima verificação será automática.</p> : null
  return <aside aria-label="Lembretes de confirmação" className="mb-5 space-y-3 rounded-xl border border-brass/40 bg-brass/10 p-4">
    <p className="font-semibold text-brass">Hora de confirmar os atendimentos</p>
    {items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 text-sm text-white">{item.body}</p><button type="button" onClick={() => { onOpen(item.booking_id) }} className="min-h-11 rounded-lg border border-brass/40 px-3 py-2 text-sm text-brass">Ver na agenda</button></div>)}
  </aside>
}
