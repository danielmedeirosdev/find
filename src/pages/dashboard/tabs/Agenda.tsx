import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice, formatDate, formatTime } from '../../../lib/format'
import type { BookingWithDetails } from '../../../lib/types'

interface Props {
  shopId: string
}

export function AgendaTab({ shopId }: Props) {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          barbers(name),
          booking_services(service_id, services(name, price, duration_minutes))
        `)
        .eq('shop_id', shopId)
        .gte('date', today)
        .order('date')
        .order('time')

      setBookings((data as BookingWithDetails[]) || [])
      setLoading(false)
    }
    load()
  }, [shopId])

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  return (
    <div>
      <h2 className="font-display text-2xl text-white mb-6">Agenda</h2>

      {bookings.length === 0 ? (
        <p className="text-charcoal-muted">Nenhum agendamento futuro.</p>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const services = (b.booking_services || []).map((bs) => bs.services)
            const total = services.reduce((sum, s) => sum + Number(s.price), 0)
            return (
              <div
                key={b.id}
                className="rounded-lg border border-charcoal-light p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-mono text-brass text-lg">{formatTime(b.time)}</p>
                    <p className="text-sm text-charcoal-muted">{formatDate(b.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{b.client_name}</p>
                    <p className="text-sm text-charcoal-muted">{b.client_phone}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-charcoal-light pt-3">
                  <div>
                    <p className="text-sm text-charcoal-muted">{b.barbers?.name}</p>
                    <p className="text-sm text-white">
                      {services.map((s) => s.name).join(' · ')}
                    </p>
                  </div>
                  <p className="font-mono text-brass">{formatPrice(total)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
