import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { AppNotification } from '../../../lib/types'

interface Props {
  shopId: string
}

export function NotificationsTab({ shopId }: Props) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('shop_id', shopId)
      .eq('audience', 'owner')
      .order('created_at', { ascending: false })
      .limit(80)
    setItems((data as AppNotification[]) || [])
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('shop_id', shopId)
      .is('read_at', null)
    load()
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  const unread = items.filter((n) => !n.read_at).length

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white mb-1">Notificações</h2>
          <p className="text-sm text-charcoal-muted">
            {unread > 0 ? `${unread} não lida(s)` : 'Tudo em dia'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="rounded-lg border border-charcoal-light px-3 py-2 text-sm text-charcoal-muted hover:text-white"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-charcoal-muted">Nenhuma notificação ainda.</p>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.read_at && markRead(n.id)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                n.read_at
                  ? 'border-charcoal-light/60 opacity-70'
                  : 'border-brass/40 bg-brass/5'
              }`}
            >
              <div className="flex justify-between gap-2">
                <p className="font-medium text-white">{n.title}</p>
                <span className="shrink-0 text-xs text-charcoal-muted">
                  {new Date(n.created_at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {n.body && <p className="mt-1 text-sm text-charcoal-muted">{n.body}</p>}
              <p className="mt-2 text-[10px] uppercase tracking-widest text-charcoal-muted">{n.kind}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
