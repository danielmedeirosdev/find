import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { formatDate, formatTime } from '../../../../lib/format'
import { EmptyState, InlineError, LoadingBlock } from '../../../../components/EmptyState'
import { userFacingError } from '../../../../lib/userFacingError'
import type { BookingWithDetails } from '../../../../lib/types'

interface Props {
  shopId: string
  barberId: string
}

export function StaffClientsTab({ shopId, barberId }: Props) {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { data, error: qError } = await supabase
      .from('bookings')
      .select('id, client_name, client_phone, date, time, status')
      .eq('shop_id', shopId)
      .eq('barber_id', barberId)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(200)

    if (qError) {
      setError(userFacingError(qError, 'Não foi possível carregar seus clientes.'))
      setBookings([])
    } else {
      setBookings((data as BookingWithDetails[]) || [])
    }
    setLoading(false)
  }, [shopId, barberId])

  useEffect(() => {
    load()
  }, [load])

  const clients = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string; lastDate: string; lastTime: string; count: number }
    >()
    for (const b of bookings) {
      const key = `${(b.client_phone || '').replace(/\D/g, '')}|${(b.client_name || '').toLowerCase()}`
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          name: b.client_name,
          phone: b.client_phone,
          lastDate: b.date,
          lastTime: b.time,
          count: 1,
        })
      } else {
        existing.count += 1
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [bookings])

  if (loading) return <LoadingBlock label="Carregando clientes..." />

  return (
    <div>
      <h2 className="font-display text-2xl text-white mb-2">Meus clientes</h2>
      <p className="text-sm text-charcoal-muted mb-6">
        Clientes dos seus atendimentos — apenas o necessário para executar o dia.
      </p>
      {error && (
        <div className="mb-4">
          <InlineError message={error} />
        </div>
      )}
      {clients.length === 0 ? (
        <EmptyState
          title="Ainda não há clientes nos seus atendimentos."
          description="Quando houver agendamentos na sua agenda, os clientes aparecerão aqui."
        />
      ) : (
        <ul className="space-y-3">
          {clients.map((c) => (
            <li
              key={`${c.phone}-${c.name}`}
              className="rounded-xl border border-charcoal-light px-4 py-3"
            >
              <p className="font-medium text-white">{c.name}</p>
              <p className="text-sm text-charcoal-muted">{c.phone || 'Sem telefone'}</p>
              <p className="mt-1 text-xs text-charcoal-muted">
                Último: {formatDate(c.lastDate)} · {formatTime(c.lastTime)} · {c.count}{' '}
                {c.count === 1 ? 'atendimento' : 'atendimentos'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
