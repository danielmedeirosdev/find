import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice, formatDate, formatTime, bookingStatusLabel, paymentMethodLabel } from '../../lib/format'
import { petSizeLabel } from '../../lib/pet'
import type { BookingWithDetails } from '../../lib/types'
import { BrandAccent } from '../../components/BrandAccent'
import { ReviewModal } from '../../components/reviews/ReviewModal'
import { useAuth } from '../../contexts/AuthContext'

function phoneDigits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '')
}

export function MyBookings() {
  const { user, clientProfile, loading: authLoading } = useAuth()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewBooking, setReviewBooking] = useState<BookingWithDetails | null>(null)

  const load = async () => {
    if (!user) return

    // Recupera agendamentos PET/barbearia feitos sem client_id (guest) pelo WhatsApp
    await supabase.rpc('claim_my_bookings')

    const phone = phoneDigits(clientProfile?.phone)
    let query = supabase
      .from('bookings')
      .select(`
        *,
        shops(name, address, segment),
        pets!bookings_pet_id_fkey(name, size),
        booking_pets(pet_id, pets(name, size)),
        booking_services(service_id, services(name, price))
      `)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    if (phone.length >= 10) {
      const variants = Array.from(
        new Set([phone, phone.startsWith('55') ? phone.slice(2) : `55${phone}`])
      )
      query = query.or(
        [`client_id.eq.${user.id}`, ...variants.map((p) => `client_phone.eq.${p}`)].join(',')
      )
    } else {
      query = query.eq('client_id', user.id)
    }

    const { data } = await query

    const rows = ((data as BookingWithDetails[]) || []).filter((b) => {
      if (b.client_id === user.id) return true
      if (!phone) return false
      const bookingPhone = phoneDigits(b.client_phone)
      return (
        bookingPhone === phone ||
        bookingPhone === `55${phone}` ||
        `55${bookingPhone}` === phone
      )
    })

    const barberIds = [...new Set(rows.map((booking) => booking.barber_id))]
    const { data: publicBarbers } = barberIds.length
      ? await supabase.from('public_barbers').select('id, name').in('id', barberIds)
      : { data: [] }
    const barberNameById = new Map(
      (publicBarbers || []).map((barber) => [barber.id, barber.name])
    )

    // Dedup if or() + claim overlap
    const seen = new Set<string>()
    setBookings(
      rows
        .map((booking) => {
          const barberName = barberNameById.get(booking.barber_id)
          return barberName ? { ...booking, barbers: { name: barberName } } : booking
        })
        .filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)))
    )
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    load()
  }, [user, clientProfile?.phone])

  if (authLoading) return <p className="text-center text-ink-muted">Carregando...</p>
  if (!user) return <Navigate to="/entrar" replace />

  const today = new Date().toISOString().slice(0, 10)
  // Uma avaliação por estabelecimento: só o primeiro awaiting de cada loja
  const awaitingReview = (() => {
    const seen = new Set<string>()
    return bookings.filter((b) => {
      if (b.status !== 'completed' || b.review_status !== 'awaiting') return false
      if (seen.has(b.shop_id)) return false
      seen.add(b.shop_id)
      return true
    })
  })()
  const upcoming = bookings.filter(
    (b) => b.date >= today && b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'no_show'
  )
  const past = bookings.filter(
    (b) =>
      !(b.date >= today && b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'no_show') &&
      !awaitingReview.some((a) => a.id === b.id)
  )

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl text-ink">Minhas Reservas</h1>
        <BrandAccent className="mx-auto max-w-xs mt-4" segment="platform" />
      </div>

      {loading ? (
        <p className="text-center text-ink-muted">Carregando suas reservas...</p>
      ) : bookings.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-ink/10 bg-white px-6 py-10 text-center">
          <p className="font-display text-2xl text-ink">Nenhuma reserva ainda</p>
          <p className="mt-2 text-sm text-ink-muted">
            Escolha um estabelecimento e marque o horário em poucos passos.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/barbearia" className="btn-primary">
              Barbearias
            </Link>
            <Link to="/pet" className="btn-secondary">
              Pet shops
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {awaitingReview.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-ink mb-2">Como foi seu atendimento?</h2>
              <p className="text-sm text-ink-muted mb-4">
                Sua opinião ajuda outras pessoas a escolherem e ajuda o profissional a melhorar.
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
          shopName={reviewBooking.shops?.name || 'Estabelecimento'}
          barberName={reviewBooking.barbers?.name}
          onClose={() => setReviewBooking(null)}
  onSubmitted={() => {
            const shopId = reviewBooking.shop_id
            setBookings((prev) =>
              prev.map((b) => {
                if (b.id === reviewBooking.id) {
                  return { ...b, review_status: 'reviewed' as const }
                }
                if (
                  b.shop_id === shopId &&
                  b.status === 'completed' &&
                  b.review_status === 'awaiting'
                ) {
                  return { ...b, review_status: 'unavailable' as const }
                }
                return b
              })
            )
            setReviewBooking(null)
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
  const pet = booking.pets

  return (
    <div
      className={`rounded-lg border bg-white p-5 ${
        highlightReview ? 'border-brass shadow-sm ring-1 ring-brass/20' : 'border-paper-dark'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-display text-xl text-ink">{booking.shops?.name}</h3>
          {pet?.name ? (
            <p className="text-sm text-ink-muted">
              {pet.name}
              {pet.size ? ` · ${petSizeLabel(pet.size)}` : ''}
              {booking.barbers?.name ? ` · ${booking.barbers.name}` : ''}
            </p>
          ) : (
            <p className="text-sm text-ink-muted">{booking.barbers?.name}</p>
          )}
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
        <p className="mt-3 text-xs font-medium text-brass">Você já avaliou este atendimento</p>
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
