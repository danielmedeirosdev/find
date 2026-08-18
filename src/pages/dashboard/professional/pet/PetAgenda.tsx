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
import { EmptyState, InlineError, LoadingBlock } from '../../../../components/EmptyState'
import { userFacingError } from '../../../../lib/userFacingError'
import type { BookingWithDetails, Service } from '../../../../lib/types'

interface Props {
  shopId: string
  barberId?: string
}

type DayFilter = 'today' | 'tomorrow' | 'upcoming'

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function PetAgenda({ shopId, barberId }: Props) {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [shopServices, setShopServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [completingBooking, setCompletingBooking] = useState<BookingWithDetails | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [clientHistory, setClientHistory] = useState<BookingWithDetails[]>([])
  const [searching, setSearching] = useState(false)
  const [actionError, setActionError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [dayFilter, setDayFilter] = useState<DayFilter>('today')
  const today = addDaysIso(0)
  const tomorrow = addDaysIso(1)

  const bookingSelect = `
    *,
    barbers(name),
    pets!bookings_pet_id_fkey(id, name, size, photo_url, breed),
    booking_pets(pet_id, pets(id, name, size, photo_url, breed)),
    booking_services(service_id, services(name, price, duration_minutes))
  `

  const petsForBooking = (b: BookingWithDetails) => {
    const fromJoin = (b.booking_pets || [])
      .map((row) => row.pets)
      .filter(Boolean) as NonNullable<BookingWithDetails['pets']>[]
    if (fromJoin.length > 0) return fromJoin
    return b.pets ? [b.pets] : []
  }

  const load = useCallback(async () => {
    setLoadError('')
    let query = supabase
      .from('bookings')
      .select(bookingSelect)
      .eq('shop_id', shopId)
      .gte('date', today)
      .order('date')
      .order('time')
    if (barberId) query = query.eq('barber_id', barberId)

    const [{ data, error }, { data: svc }] = await Promise.all([
      query,
      supabase.from('services').select('*').eq('shop_id', shopId).order('name'),
    ])

    if (error) {
      setLoadError(userFacingError(error, 'Não foi possível carregar a agenda.'))
      setBookings([])
    } else {
      setBookings((data as BookingWithDetails[]) || [])
    }
    setShopServices(svc || [])
    setLoading(false)
  }, [shopId, barberId, today])

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
      setActionError(userFacingError(error, 'Não foi possível atualizar o atendimento.'))
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

    if (barberId) q = q.eq('barber_id', barberId)

    if (digits.length >= 8) {
      q = q.ilike('client_phone', `%${digits}%`)
    } else {
      q = q.ilike('client_name', `%${query}%`)
    }

    const { data } = await q.limit(50)
    setClientHistory((data as BookingWithDetails[]) || [])
    setSearching(false)
  }

  if (loading) return <LoadingBlock label="Carregando agenda..." />

  const activeBookings = bookings.filter(
    (b) =>
      b.status === 'scheduled' ||
      b.status === 'confirmed' ||
      b.status === 'in_progress' ||
      b.status === 'awaiting_payment' ||
      !b.status
  )
  const filtered =
    dayFilter === 'today'
      ? activeBookings.filter((b) => b.date === today)
      : dayFilter === 'tomorrow'
        ? activeBookings.filter((b) => b.date === tomorrow)
        : activeBookings
  const nextUp = activeBookings[0] || null

  return (
    <div className="overflow-x-hidden">
      <h2 className="font-display text-2xl text-white mb-2">
        {barberId ? 'Minha agenda' : 'Agenda'}
      </h2>
      <p className="text-sm text-charcoal-muted mb-4">
        Veja pet, porte, duração e serviço. Finalize para registrar no histórico e no caixa.
      </p>
      {(actionError || loadError) && (
        <div className="mb-4">
          <InlineError message={actionError || loadError} />
        </div>
      )}

      {nextUp && (
        <section className="mb-6 rounded-xl border border-brass/40 bg-brass/5 p-4">
          <p className="text-[11px] uppercase tracking-widest text-brass/90">Próximo atendimento</p>
          <p className="mt-2 font-mono text-2xl text-brass">{formatTime(nextUp.time)}</p>
          <p className="text-sm text-charcoal-muted">{formatDate(nextUp.date)}</p>
          <p className="mt-2 text-lg font-medium text-white">{nextUp.client_name}</p>
        </section>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {([['today', 'Hoje'], ['tomorrow', 'Amanhã'], ['upcoming', 'Próximos']] as const).map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDayFilter(key)}
              className={`shrink-0 rounded-lg px-4 py-2.5 text-sm min-h-[44px] ${
                dayFilter === key
                  ? 'bg-brass text-charcoal font-semibold'
                  : 'border border-charcoal-light text-charcoal-muted'
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      <div className="mb-8 rounded-lg border border-charcoal-light p-4">
        <h3 className="font-medium text-white mb-3">Histórico do cliente / pet</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchClientHistory()}
            placeholder="Buscar por nome ou telefone"
            className="w-full flex-1 rounded-lg border border-charcoal-light bg-charcoal px-4 py-2.5 text-white focus:border-brass focus:outline-none min-h-[44px]"
          />
          <button
            type="button"
            onClick={searchClientHistory}
            disabled={searching}
            className="rounded-lg bg-brass px-4 py-2.5 font-semibold text-charcoal disabled:opacity-50 min-h-[44px]"
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {clientHistory.length > 0 && (
          <div className="mt-4 space-y-3">
            {clientHistory.map((b) => {
              const services = (b.booking_services || []).map((bs) => bs.services)
              const total = services.reduce((sum, s) => sum + Number(s?.price || 0), 0)
              const petList = petsForBooking(b)
              const petLabel = petList.map((p) => p.name).join(' · ')
              return (
                <div key={b.id} className="rounded-lg bg-charcoal-light/30 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white">
                      {petLabel ? `${petLabel} · ${b.client_name}` : b.client_name}
                    </span>
                    <span className="font-mono text-brass">{formatPrice(total)}</span>
                  </div>
                  <p className="text-charcoal-muted">
                    {formatDate(b.date)} · {formatTime(b.time)} · {b.barbers?.name} ·{' '}
                    {paymentMethodLabel(b.payment_method)}
                  </p>
                  <p className="text-white">{services.map((s) => s.name).join(' · ')}</p>
                  {b.notes && <p className="text-charcoal-muted mt-1">Obs: {b.notes}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento neste período."
          description="Quando houver reservas, elas aparecem aqui com pet, horário e serviço."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            const services = Array.from(
              new Map(
                (b.booking_services || []).map((bs) => [bs.service_id, bs.services])
              ).values()
            )
            const total = services.reduce((sum, s) => sum + Number(s?.price || 0), 0)
            const status = b.status || 'scheduled'
            const duration =
              b.duration_minutes ||
              services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
            const petList = petsForBooking(b)
            const mainPet = petList[0]
            return (
              <div key={b.id} className="rounded-lg border border-charcoal-light p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div className="flex gap-3">
                    {mainPet?.photo_url ? (
                      <img
                        src={mainPet.photo_url}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover"
                      />
                    ) : mainPet ? (
                      <DefaultAvatar
                        name={mainPet.name}
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
                    {petList.length > 0 ? (
                      <>
                        <p className="font-medium text-white text-lg">
                          {petList.map((p) => p.name).join(' · ')}
                        </p>
                        <p className="text-sm text-charcoal-muted">
                          {petList
                            .map((p) => `${p.breed || 'Pet'} · ${petSizeLabel(p.size)}`)
                            .join(' · ')}
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
                    {b.notes && (
                      <p className="text-sm text-brass mt-1">Obs: {b.notes}</p>
                    )}
                  </div>
                  <p className="font-mono text-brass">{formatPrice(total)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(status === 'scheduled' || !b.status) && (
                    <button
                      onClick={() => updateStatus(b.id, 'confirmed')}
                      className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white"
                    >
                      Confirmar
                    </button>
                  )}
                  {(status === 'scheduled' || status === 'confirmed') && (
                    <button
                      onClick={() => updateStatus(b.id, 'in_progress')}
                      className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white"
                    >
                      Iniciar
                    </button>
                  )}
                  {(status === 'in_progress' || status === 'confirmed' || status === 'scheduled') && (
                    <button
                      onClick={() => updateStatus(b.id, 'awaiting_payment')}
                      className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white"
                    >
                      Aguardando pagamento
                    </button>
                  )}
                  <button
                    onClick={() => setCompletingBooking(b)}
                    className="min-h-[44px] rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal"
                  >
                    Finalizar atendimento
                  </button>
                  <button
                    onClick={() => updateStatus(b.id, 'no_show')}
                    className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white"
                  >
                    Não compareceu
                  </button>
                  <button
                    onClick={() => updateStatus(b.id, 'cancelled')}
                    className="min-h-[44px] rounded-lg border border-red-400/50 px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10"
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
