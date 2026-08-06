import { useEffect, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice, formatDate, formatTime, formatDuration } from '../../lib/format'
import { getTotalDuration, getTotalPrice } from '../../lib/booking'
import type { BookingConfirmationState, BookingWithDetails } from '../../lib/types'
import { BarberPole } from '../../components/BarberPole'
import { useAuth } from '../../contexts/AuthContext'

export function BookingConfirm() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const confirmationState = location.state as BookingConfirmationState | null
  const [booking, setBooking] = useState<BookingWithDetails | null>(null)
  const [loading, setLoading] = useState(!confirmationState)

  useEffect(() => {
    if (confirmationState || !bookingId) return

    async function load() {
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          shops(name, address, phone),
          barbers(name),
          booking_services(service_id, services(*))
        `)
        .eq('id', bookingId)
        .single()

      setBooking(data as BookingWithDetails)
      setLoading(false)
    }
    load()
  }, [bookingId, confirmationState])

  if (loading) return <p className="text-center text-ink-muted">Carregando...</p>

  if (confirmationState) {
    const totalPrice = getTotalPrice(confirmationState.services)
    const totalDuration = getTotalDuration(confirmationState.services)

    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-lg border-2 border-dashed border-ink/20 bg-white p-8 shadow-sm">
          <div className="text-center mb-6">
            <p className="font-display text-sm tracking-widest text-ink-muted">COMANDA</p>
            <BarberPole className="my-3" height="h-2" />
            <h1 className="font-display text-3xl text-ink">Agendamento confirmado!</h1>
          </div>

          <div className="space-y-4 font-mono text-sm">
            <div className="border-b border-dashed border-ink/10 pb-3">
              <p className="text-ink-muted text-xs uppercase">Barbearia</p>
              <p className="text-lg font-semibold text-ink">{confirmationState.shopName}</p>
              {confirmationState.shopAddress && (
                <p className="text-ink-muted">{confirmationState.shopAddress}</p>
              )}
            </div>

            <div className="border-b border-dashed border-ink/10 pb-3">
              <p className="text-ink-muted text-xs uppercase">Profissional</p>
              <p>{confirmationState.barberName}</p>
            </div>

            <div className="border-b border-dashed border-ink/10 pb-3">
              <p className="text-ink-muted text-xs uppercase">Data e hora</p>
              <p>{formatDate(confirmationState.date)}</p>
              <p className="text-brass text-lg">{formatTime(confirmationState.time)}</p>
              <p className="text-ink-muted">{formatDuration(totalDuration)}</p>
            </div>

            <div className="border-b border-dashed border-ink/10 pb-3">
              <p className="text-ink-muted text-xs uppercase">Serviços</p>
              {confirmationState.services.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.name}</span>
                  <span>{formatPrice(Number(s.price))}</span>
                </div>
              ))}
            </div>

            <div className="border-b border-dashed border-ink/10 pb-3">
              <p className="text-ink-muted text-xs uppercase">Cliente</p>
              <p>{confirmationState.clientName}</p>
              <p className="text-ink-muted">{confirmationState.clientPhone}</p>
            </div>

            <div className="flex justify-between text-lg font-semibold text-brass pt-2">
              <span>TOTAL</span>
              <span>{formatPrice(totalPrice)}</span>
            </div>
          </div>

          <BarberPole className="my-6" height="h-1" />

          {!user && (
            <div className="rounded-lg bg-paper p-4 text-center text-sm">
              <p className="mb-3">Quer acompanhar suas reservas?</p>
              <Link
                to="/cadastro"
                className="inline-block rounded-lg bg-brass px-6 py-2 font-semibold text-white hover:bg-brass-light transition-colors"
              >
                Crie uma conta rápida
              </Link>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 text-center text-sm">
            <Link to="/" className="text-brass hover:underline">
              Voltar à lista de barbearias
            </Link>
            {user && (
              <Link to="/minhas-reservas" className="text-ink-muted hover:text-brass">
                Ver minhas reservas
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!booking) return <p className="text-center text-ink-muted">Agendamento não encontrado.</p>

  const services = (booking.booking_services || []).map((bs) => bs.services)
  const totalPrice = getTotalPrice(services)
  const totalDuration = getTotalDuration(services)

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border-2 border-dashed border-ink/20 bg-white p-8 shadow-sm">
        <div className="text-center mb-6">
          <p className="font-display text-sm tracking-widest text-ink-muted">COMANDA</p>
          <BarberPole className="my-3" height="h-2" />
          <h1 className="font-display text-3xl text-ink">Agendamento confirmado!</h1>
        </div>

        <div className="space-y-4 font-mono text-sm">
          <div className="border-b border-dashed border-ink/10 pb-3">
            <p className="text-ink-muted text-xs uppercase">Barbearia</p>
            <p className="text-lg font-semibold text-ink">{booking.shops?.name}</p>
            {booking.shops?.address && (
              <p className="text-ink-muted">{booking.shops.address}</p>
            )}
          </div>

          <div className="border-b border-dashed border-ink/10 pb-3">
            <p className="text-ink-muted text-xs uppercase">Profissional</p>
            <p>{booking.barbers?.name}</p>
          </div>

          <div className="border-b border-dashed border-ink/10 pb-3">
            <p className="text-ink-muted text-xs uppercase">Data e hora</p>
            <p>{formatDate(booking.date)}</p>
            <p className="text-brass text-lg">{formatTime(booking.time)}</p>
            <p className="text-ink-muted">{formatDuration(totalDuration)}</p>
          </div>

          <div className="border-b border-dashed border-ink/10 pb-3">
            <p className="text-ink-muted text-xs uppercase">Serviços</p>
            {services.map((s) => (
              <div key={s.id} className="flex justify-between">
                <span>{s.name}</span>
                <span>{formatPrice(Number(s.price))}</span>
              </div>
            ))}
          </div>

          <div className="border-b border-dashed border-ink/10 pb-3">
            <p className="text-ink-muted text-xs uppercase">Cliente</p>
            <p>{booking.client_name}</p>
            <p className="text-ink-muted">{booking.client_phone}</p>
          </div>

          <div className="flex justify-between text-lg font-semibold text-brass pt-2">
            <span>TOTAL</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
        </div>

        <BarberPole className="my-6" height="h-1" />

        {!user && (
          <div className="rounded-lg bg-paper p-4 text-center text-sm">
            <p className="mb-3">Quer acompanhar suas reservas?</p>
            <Link
              to="/cadastro"
              className="inline-block rounded-lg bg-brass px-6 py-2 font-semibold text-white hover:bg-brass-light transition-colors"
            >
              Crie uma conta rápida
            </Link>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 text-center text-sm">
          <Link to="/" className="text-brass hover:underline">
            Voltar à lista de barbearias
          </Link>
          {user && (
            <Link to="/minhas-reservas" className="text-ink-muted hover:text-brass">
              Ver minhas reservas
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
