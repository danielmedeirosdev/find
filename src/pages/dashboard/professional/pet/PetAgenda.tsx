import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import {
  formatPrice,
  formatDate,
  formatTime,
  formatDuration,
  bookingStatusLabel,
  paymentMethodLabel,
} from '../../../../lib/format'
import { petSizeLabel } from '../../../../lib/pet'
import { CompleteBookingModal } from '../../../../components/CompleteBookingModal'
import { DefaultAvatar } from '../../../../components/MediaUI'
import type { BookingWithDetails, Service } from '../../../../lib/types'

interface Props {
  shopId: string
}

export function PetAgenda({ shopId }: Props) {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [shopServices, setShopServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [completingBooking, setCompletingBooking] = useState<BookingWithDetails | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [clientHistory, setClientHistory] = useState<BookingWithDetails[]>([])
  const [searching, setSearching] = useState(false)
  const [actionError, setActionError] = useState('')

  const bookingSelect = `
    *,
    barbers(name),
    pets(id, name, size, photo_url, breed),
    booking_services(service_id, services(name, price, duration_minutes))
  `

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const [{ data }, { data: svc }] = await Promise.all([
      supabase
        .from('bookings')
        .select(bookingSelect)
        .eq('shop_id', shopId)
        .gte('date', today)
        .order('date')
        .order('time'),
      supabase.from('services').select('*').eq('shop_id', shopId).order('name'),
    ])

    setBookings((data as BookingWithDetails[]) || [])
    setShopServices(svc || [])
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (
    bookingId: string,
    status: 'confirmed' | 'in_progress' | 'awaiting_payment' | 'no_show' | 'cancelled' | 'scheduled'
  ) => {
    setActionError('')
    const { error } = await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_status: status,
    })
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  const searchClientHistory = async () => {
    const query = clientSearch.trim()
    if (!query) return
    setSearching(true)
    const digits = query.replace(/\D/g, '')
    let q = supabase
      .from('bookings')
      .select(bookingSelect)
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .order('date', { ascending: false })
      .order('time', { ascending: false })

    if (digits.length >= 8) {
      q = q.ilike('client_phone', `%${digits}%`)
    } else {
      q = q.ilike('client_name', `%${query}%`)
    }

    const { data } = await q.limit(50)
    setClientHistory((data as BookingWithDetails[]) || [])
    setSearching(false)
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  const activeBookings = bookings.filter(
    (b) =>
      b.status === 'scheduled' ||
      b.status === 'confirmed' ||
      b.status === 'in_progress' ||
      b.status === 'awaiting_payment' ||
      !b.status
  )

  return (
    <div>
      <h2 className="font-display text-2xl text-white mb-2">Agenda</h2>
      <p className="text-sm text-charcoal-muted mb-4">
        Veja pet, porte, duração e serviço. Finalize para registrar no histórico e no caixa.
      </p>
      {actionError && <p className="mb-4 text-sm text-red-400">{actionError}</p>}

      <div className="mb-8 rounded-lg border border-charcoal-light p-4">
        <h3 className="font-medium text-white mb-3">Histórico do cliente / pet</h3>
        <div className="flex gap-2">
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchClientHistory()}
            placeholder="Buscar por nome ou telefone"
            className="flex-1 rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
          />
          <button
            onClick={searchClientHistory}
            disabled={searching}
            className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal disabled:opacity-50"
          >
            {searching ? '...' : 'Buscar'}
          </button>
        </div>
        {clientHistory.length > 0 && (
          <div className="mt-4 space-y-3">
            {clientHistory.map((b) => {
              const services = (b.booking_services || []).map((bs) => bs.services)
              const total = services.reduce((sum, s) => sum + Number(s.price), 0)
              return (
                <div key={b.id} className="rounded-lg bg-charcoal-light/30 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white">
                      {b.pets?.name ? `${b.pets.name} · ${b.client_name}` : b.client_name}
                    </span>
                    <span className="font-mono text-brass">{formatPrice(total)}</span>
                  </div>
                  <p className="text-charcoal-muted">
                    {formatDate(b.date)} · {formatTime(b.time)} · {b.barbers?.name} ·{' '}
                    {paymentMethodLabel(b.payment_method)}
                  </p>
                  <p className="text-white">{services.map((s) => s.name).join(' · ')}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {activeBookings.length === 0 ? (
        <p className="text-charcoal-muted">Nenhum agendamento pendente.</p>
      ) : (
        <div className="space-y-4">
          {activeBookings.map((b) => {
            const services = Array.from(
              new Map(
                (b.booking_services || []).map((bs) => [bs.service_id, bs.services])
              ).values()
            )
            const total = services.reduce((sum, s) => sum + Number(s.price), 0)
            const status = b.status || 'scheduled'
            const duration =
              b.duration_minutes ||
              services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
            return (
              <div key={b.id} className="rounded-lg border border-charcoal-light p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div className="flex gap-3">
                    {b.pets?.photo_url ? (
                      <img
                        src={b.pets.photo_url}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover"
                      />
                    ) : b.pets ? (
                      <DefaultAvatar
                        name={b.pets.name}
                        className="h-14 w-14 rounded-xl text-lg"
                      />
                    ) : null}
                    <div>
                      <p className="font-mono text-brass text-lg">{formatTime(b.time)}</p>
                      <p className="text-sm text-charcoal-muted">{formatDate(b.date)}</p>
                      {duration > 0 && (
                        <p className="text-xs text-charcoal-muted mt-1">
                          {formatDuration(duration)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-charcoal-light px-2 py-0.5 text-xs text-charcoal-muted mb-1">
                      {bookingStatusLabel(status)}
                    </span>
                    {b.pets ? (
                      <>
                        <p className="font-medium text-white text-lg">{b.pets.name}</p>
                        <p className="text-sm text-charcoal-muted">
                          {b.pets.breed || 'Pet'} · {petSizeLabel(b.pets.size)}
                        </p>
                        <p className="text-sm text-white mt-1">Cliente: {b.client_name}</p>
                        <p className="text-sm text-charcoal-muted">{b.client_phone}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-white">{b.client_name}</p>
                        <p className="text-sm text-charcoal-muted">{b.client_phone}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-charcoal-light pt-3">
                  <div>
                    <p className="text-sm text-charcoal-muted">{b.barbers?.name}</p>
                    <p className="text-sm text-white">
                      {services.map((s) => s.name).join(' · ') || 'Serviço'}
                    </p>
                  </div>
                  <p className="font-mono text-brass">{formatPrice(total)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(status === 'scheduled' || !b.status) && (
                    <button
                      onClick={() => updateStatus(b.id, 'confirmed')}
                      className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:text-white"
                    >
                      Confirmar
                    </button>
                  )}
                  {(status === 'scheduled' || status === 'confirmed') && (
                    <button
                      onClick={() => updateStatus(b.id, 'in_progress')}
                      className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:text-white"
                    >
                      Iniciar
                    </button>
                  )}
                  {(status === 'in_progress' || status === 'confirmed' || status === 'scheduled') && (
                    <button
                      onClick={() => updateStatus(b.id, 'awaiting_payment')}
                      className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:text-white"
                    >
                      Aguardando pagamento
                    </button>
                  )}
                  <button
                    onClick={() => setCompletingBooking(b)}
                    className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal"
                  >
                    Finalizar atendimento
                  </button>
                  <button
                    onClick={() => updateStatus(b.id, 'no_show')}
                    className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:text-white"
                  >
                    Não compareceu
                  </button>
                  <button
                    onClick={() => updateStatus(b.id, 'cancelled')}
                    className="rounded-lg border border-red-400/50 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10"
                  >
                    Cancelado
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {completingBooking && (
        <CompleteBookingModal
          booking={completingBooking}
          shopServices={shopServices}
          onClose={() => setCompletingBooking(null)}
          onComplete={() => {
            setCompletingBooking(null)
            load()
          }}
        />
      )}
    </div>
  )
}
