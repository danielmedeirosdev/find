import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice, formatDate, formatTime, bookingStatusLabel, paymentMethodLabel } from '../../lib/format'
import type { BookingWithDetails } from '../../lib/types'
import { BarberPole } from '../../components/BarberPole'
import { ReviewModal } from '../../components/reviews/ReviewModal'
import { useAuth } from '../../contexts/AuthContext'

export function MyBookings() {
  const { user, loading: authLoading } = useAuth()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewBooking, setReviewBooking] = useState<BookingWithDetails | null>(null)

  const load = async () => {
    if (!user) return
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        shops(name, address),
        barbers(name),
        booking_services(service_id, services(name, price))
      `)
      .eq('client_id', user.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    setBookings((data as BookingWithDetails[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  if (authLoading) return <p className="text-center text-ink-muted">Carregando...</p>
  if (!user) return <Navigate to="/entrar" replace />

  const today = new Date().toISOString().slice(0, 10)
  const awaitingReview = bookings.filter(
    (b) => b.status === 'completed' && b.review_status === 'awaiting'
  )
  const upcoming = bookings.filter(
    (b) => b.date >= today && b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'no_show'
  )
  const past = bookings.filter(
    (b) =>
      !(b.date >= today && b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'no_show') &&
      !(b.status === 'completed' && b.review_status === 'awaiting')
  )

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
          {awaitingReview.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-ink mb-2">Como foi seu atendimento?</h2>
              <p className="text-sm text-ink-muted mb-4">
                Sua opinião ajuda outras pessoas a escolherem um barbeiro e ajuda o profissional a
                melhorar.
              </p>
              <div className="space-y-4">
                {awaitingReview.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onReview={() => setReviewBooking(b)}
                    highlightReview
                  />
                ))}
              </div>
            </section>
          )}

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
              <div className="space-y-4 opacity-80">
                {past.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onReview={
                      b.status === 'completed' && b.review_status === 'awaiting'
                        ? () => setReviewBooking(b)
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {reviewBooking && (
        <ReviewModal
          bookingId={reviewBooking.id}
          shopName={reviewBooking.shops?.name || 'Barbearia'}
          barberName={reviewBooking.barbers?.name}
          onClose={() => setReviewBooking(null)}
          onSubmitted={() => {
            setBookings((prev) =>
              prev.map((b) =>
                b.id === reviewBooking.id ? { ...b, review_status: 'reviewed' as const } : b
              )
            )
          }}
        />
      )}
    </div>
  )
}

function BookingCard({
  booking,
  onReview,
  highlightReview,
}: {
  booking: BookingWithDetails
  onReview?: () => void
  highlightReview?: boolean
}) {
  const services = (booking.booking_services || []).map((bs) => bs.services)
  const total = services.reduce((sum, s) => sum + Number(s.price), 0)
  const isCompleted = booking.status === 'completed'
  const canReview = isCompleted && booking.review_status === 'awaiting' && onReview
  const reviewed = booking.review_status === 'reviewed'

  return (
    <div
      className={`rounded-lg border bg-white p-5 ${
        highlightReview ? 'border-brass shadow-sm ring-1 ring-brass/20' : 'border-paper-dark'
      }`}
    >
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
      {reviewed && (
        <p className="mt-3 text-xs font-medium text-brass">✓ Você já avaliou este atendimento</p>
      )}
      {canReview && (
        <button
          type="button"
          onClick={onReview}
          className="mt-4 w-full rounded-lg bg-brass py-2.5 text-sm font-semibold text-charcoal hover:bg-brass-light transition-colors"
        >
          Avaliar atendimento
        </button>
      )}
    </div>
  )
}
