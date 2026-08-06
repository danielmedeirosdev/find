import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice, formatDate, formatTime, bookingStatusLabel, paymentMethodLabel } from '../../lib/format'
import type { BookingWithDetails } from '../../lib/types'
import { BarberPole } from '../../components/BarberPole'
import { useAuth } from '../../contexts/AuthContext'

export function MyBookings() {
  const { user, loading: authLoading } = useAuth()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          shops(name, address),
          barbers(name),
          booking_services(service_id, services(name, price))
        `)
        .eq('client_id', user!.id)
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      setBookings((data as BookingWithDetails[]) || [])
      setLoading(false)
    }
    load()
  }, [user])

  if (authLoading) return <p className="text-center text-ink-muted">Carregando...</p>
  if (!user) return <Navigate to="/entrar" replace />

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings.filter((b) => b.date >= today)
  const past = bookings.filter((b) => b.date < today)

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl text-ink">Minhas Reservas</h1>
        <BarberPole className="mx-auto max-w-xs mt-4" />
      </div>

      {loading ? (
        <p className="text-center text-ink-muted">Carregando...</p>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-muted mb-4">Você ainda não tem reservas.</p>
          <Link to="/" className="text-brass hover:underline">
            Encontrar uma barbearia
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-ink mb-4">Próximas</h2>
              <div className="space-y-4">
                {upcoming.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-ink-muted mb-4">Anteriores</h2>
              <div className="space-y-4 opacity-70">
                {past.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function BookingCard({ booking }: { booking: BookingWithDetails }) {
  const services = (booking.booking_services || []).map((bs) => bs.services)
  const total = services.reduce((sum, s) => sum + Number(s.price), 0)
  const isCompleted = booking.status === 'completed'

  return (
    <div className="rounded-lg border border-paper-dark bg-white p-5">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-display text-xl text-ink">{booking.shops?.name}</h3>
          <p className="text-sm text-ink-muted">{booking.barbers?.name}</p>
          {booking.status && (
            <span className="inline-block mt-1 rounded-full bg-paper px-2 py-0.5 text-xs text-ink-muted">
              {bookingStatusLabel(booking.status)}
            </span>
          )}
        </div>
        <div className="text-right font-mono text-sm">
          <p>{formatDate(booking.date)}</p>
          <p className="text-brass text-lg">{formatTime(booking.time)}</p>
        </div>
      </div>
      <div className="mt-3 text-sm text-ink-muted">
        {services.map((s) => s.name).join(' · ')}
      </div>
      <p className="mt-2 font-mono text-brass">{formatPrice(total)}</p>
      {isCompleted && booking.payment_method && (
        <p className="mt-1 text-xs text-ink-muted">
          Pagamento: {paymentMethodLabel(booking.payment_method)}
        </p>
      )}
    </div>
  )
}
