import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  formatPrice,
  formatDate,
  formatTime,
  formatDuration,
  bookingStatusLabel,
  paymentMethodLabel,
} from '../../../lib/format'
import { CompleteBookingModal } from '../../../components/CompleteBookingModal'
import { EmptyState, InlineError, LoadingBlock } from '../../../components/EmptyState'
import { userFacingError } from '../../../lib/userFacingError'
import type { BookingWithDetails, Service } from '../../../lib/types'

interface Props {
  shopId: string
  /** When set, restricts agenda to this professional (staff area). */
  barberId?: string
}

type DayFilter = 'today' | 'tomorrow' | 'upcoming'

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function isActiveStatus(status: string | undefined) {
  return (
    status === 'scheduled' ||
    status === 'confirmed' ||
    status === 'in_progress' ||
    status === 'awaiting_payment' ||
    !status
  )
}

export function AgendaTab({ shopId, barberId }: Props) {
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
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)

  const today = addDaysIso(0)
  const tomorrow = addDaysIso(1)

  const bookingSelect = `
    *,
    barbers(name),
    booking_services(service_id, services(name, price, duration_minutes))
  `

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
    setStatusUpdatingId(bookingId)
    const { error } = await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_status: status,
    })
    if (error) {
      setActionError(userFacingError(error, 'Não foi possível atualizar o atendimento.'))
    } else {
      await load()
    }
    setStatusUpdatingId(null)
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

  const activeBookings = useMemo(
    () => bookings.filter((b) => isActiveStatus(b.status)),
    [bookings]
  )

  const filtered = useMemo(() => {
    if (dayFilter === 'today') return activeBookings.filter((b) => b.date === today)
    if (dayFilter === 'tomorrow') return activeBookings.filter((b) => b.date === tomorrow)
    return activeBookings
  }, [activeBookings, dayFilter, today, tomorrow])

  const nextUp = useMemo(() => {
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return (
      activeBookings.find((b) => b.date > today || (b.date === today && b.time >= currentTime)) ||
      activeBookings[0] ||
      null
    )
  }, [activeBookings, today])

  if (loading) return <LoadingBlock label="Carregando agenda..." />

  return (
    <div className="overflow-x-hidden">
      <h2 className="font-display text-2xl text-white mb-2">
        {barberId ? 'Minha agenda' : 'Agenda'}
      </h2>
      <p className="text-sm text-charcoal-muted mb-4">
        {barberId
          ? 'Seus próximos atendimentos. Finalize para registrar o pagamento.'
          : 'Finalize o atendimento para registrar o pagamento no caixa.'}
      </p>
      {loadError && (
        <div className="mb-4">
          <InlineError message={loadError} />
        </div>
      )}
      {actionError && (
        <div className="mb-4">
          <InlineError message={actionError} />
        </div>
      )}

      {nextUp && (
        <section className="mb-6 rounded-xl border border-brass/40 bg-brass/5 p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-widest text-brass/90">Próximo atendimento</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-2xl text-brass sm:text-3xl">{formatTime(nextUp.time)}</p>
              <p className="text-sm text-charcoal-muted">{formatDate(nextUp.date)}</p>
              <p className="mt-2 text-lg font-medium text-white truncate">{nextUp.client_name}</p>
              <p className="text-sm text-charcoal-muted">
                {(nextUp.booking_services || [])
                  .map((bs) => bs.services?.name)
                  .filter(Boolean)
                  .join(' · ') || 'Serviço'}
              </p>
            </div>
            <span className="rounded-full bg-charcoal-light px-3 py-1 text-xs text-charcoal-muted">
              {bookingStatusLabel(nextUp.status || 'scheduled')}
            </span>
          </div>
        </section>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(
          [
            ['today', 'Hoje'],
            ['tomorrow', 'Amanhã'],
            ['upcoming', 'Próximos'],
          ] as const
        ).map(([key, label]) => (
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
        ))}
      </div>

      <div className="mb-8 rounded-lg border border-charcoal-light p-4">
        <h3 className="font-medium text-white mb-3">Histórico do cliente</h3>
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
            className="rounded-lg bg-brass px-4 py-2.5 font-semibold text-charcoal disabled:opacity-50 min-h-[44px] sm:w-auto"
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {clientHistory.length > 0 && (
          <div className="mt-4 space-y-3">
            {clientHistory.map((b) => {
              const services = (b.booking_services || []).map((bs) => bs.services)
              const total = services.reduce((sum, s) => sum + Number(s?.price || 0), 0)
              return (
                <div key={b.id} className="rounded-lg bg-charcoal-light/30 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-white">{b.client_name}</span>
                    <span className="font-mono text-brass shrink-0">{formatPrice(total)}</span>
                  </div>
                  <p className="text-charcoal-muted">
                    {formatDate(b.date)} · {formatTime(b.time)} · {b.barbers?.name} ·{' '}
                    {paymentMethodLabel(b.payment_method)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            dayFilter === 'today'
              ? 'Nenhum atendimento para hoje.'
              : dayFilter === 'tomorrow'
                ? 'Nenhum atendimento para amanhã.'
                : 'Nenhum agendamento pendente.'
          }
          description="Quando houver reservas, elas aparecem aqui com horário, cliente e serviço."
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
              services.reduce((sum, s) => sum + (s?.duration_minutes || 0), 0)
            const busy = statusUpdatingId === b.id
            return (
              <article key={b.id} className="rounded-xl border border-charcoal-light p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-brass text-xl sm:text-2xl">{formatTime(b.time)}</p>
                    <p className="text-sm text-charcoal-muted">{formatDate(b.date)}</p>
                    {duration > 0 && (
                      <p className="text-xs text-charcoal-muted mt-1">{formatDuration(duration)}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right min-w-0">
                    <span className="inline-block rounded-full bg-charcoal-light px-2.5 py-1 text-xs text-charcoal-muted mb-1">
                      {bookingStatusLabel(status)}
                    </span>
                    <p className="font-medium text-white break-words">{b.client_name}</p>
                    <p className="text-sm text-charcoal-muted">{b.client_phone}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-charcoal-light pt-3">
                  <div className="min-w-0">
                    {!barberId && (
                      <p className="text-sm text-charcoal-muted">{b.barbers?.name}</p>
                    )}
                    <p className="text-sm text-white break-words">
                      {services.map((s) => s?.name).filter(Boolean).join(' · ') || 'Serviço'}
                    </p>
                  </div>
                  <p className="font-mono text-brass shrink-0">{formatPrice(total)}</p>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                  {(status === 'scheduled' || !b.status) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateStatus(b.id, 'confirmed')}
                      className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                  )}
                  {(status === 'scheduled' || status === 'confirmed') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateStatus(b.id, 'in_progress')}
                      className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white disabled:opacity-50"
                    >
                      Iniciar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCompletingBooking(b)}
                    className="min-h-[44px] rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal disabled:opacity-50"
                  >
                    Finalizar atendimento
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updateStatus(b.id, 'no_show')}
                    className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white disabled:opacity-50"
                  >
                    Não compareceu
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updateStatus(b.id, 'cancelled')}
                    className="min-h-[44px] rounded-lg border border-red-400/50 px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                  >
                    Cancelado
                  </button>
                </div>
              </article>
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
