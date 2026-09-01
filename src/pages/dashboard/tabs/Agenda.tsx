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
import { BookingActions, type BookingActionStatus } from '../../../components/BookingActions'
import { EmptyState, InlineError, LoadingBlock } from '../../../components/EmptyState'
import { userFacingError } from '../../../lib/userFacingError'
import { ProfessionalTimeOff } from '../../../components/ProfessionalTimeOff'
import { localDateIso } from '../../../lib/booking'
import type { BookingWithDetails, Service } from '../../../lib/types'

interface Props {
  shopId: string
  /** When set, restricts agenda to this professional (staff area). */
  barberId?: string
}

type DayFilter = 'today' | 'tomorrow' | 'upcoming'

const BOOKING_SELECT = `
  *,
  barbers(name),
  booking_services(service_id, services(name, price, duration_minutes)),
  booking_custom_field_answers(*)
`

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDateIso(d)
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
  const [showAvailability, setShowAvailability] = useState(false)

  const today = addDaysIso(0)
  const tomorrow = addDaysIso(1)

  const load = useCallback(async () => {
    setLoadError('')
    let query = supabase
      .from('bookings')
      .select(BOOKING_SELECT)
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
    status: BookingActionStatus
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
      .select(BOOKING_SELECT)
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

  const todayBookings = useMemo(
    () => activeBookings.filter((booking) => booking.date === today),
    [activeBookings, today]
  )
  const todayRevenue = useMemo(
    () =>
      todayBookings.reduce(
        (sum, booking) =>
          sum + (booking.quoted_amount != null ? Number(booking.quoted_amount) :
          Array.from(new Map((booking.booking_services || []).map((item) => [item.service_id, item.services])).values())
            .reduce((serviceSum, service) => serviceSum + Number(service?.price || 0), 0)),
        0
      ),
    [todayBookings]
  )

  if (loading) return <LoadingBlock label="Carregando agenda..." />

  return (
    <div className="overflow-x-hidden">
      <header className="mb-6 rounded-2xl border border-charcoal-light bg-gradient-to-br from-charcoal-dark via-charcoal-dark to-brass/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brass">Operação do dia</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{barberId ? 'Minha agenda' : 'Agenda da equipe'}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-charcoal-muted">Horários, clientes, serviços e andamento em uma visão organizada para a equipe.</p>
          </div>
          <button type="button" onClick={() => setShowAvailability((current) => !current)} className="min-h-11 rounded-xl border border-brass/35 bg-brass/5 px-4 text-sm font-medium text-brass transition hover:bg-brass/10">
            {showAvailability ? 'Fechar disponibilidade' : 'Configurar folgas'}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-black/15 p-3"><p className="text-xs text-charcoal-muted">Atendimentos hoje</p><p className="mt-1 text-2xl font-semibold text-white">{todayBookings.length}</p></div>
          <div className="rounded-xl border border-white/5 bg-black/15 p-3"><p className="text-xs text-charcoal-muted">Aguardando</p><p className="mt-1 text-2xl font-semibold text-white">{todayBookings.filter((item) => !['in_progress', 'awaiting_payment'].includes(item.status || '')).length}</p></div>
          <div className="rounded-xl border border-white/5 bg-black/15 p-3"><p className="text-xs text-charcoal-muted">Em atendimento</p><p className="mt-1 text-2xl font-semibold text-white">{todayBookings.filter((item) => item.status === 'in_progress').length}</p></div>
          <div className="rounded-xl border border-brass/20 bg-brass/5 p-3"><p className="text-xs text-brass/80">Previsto hoje</p><p className="mt-1 font-mono text-xl text-brass">{formatPrice(todayRevenue)}</p></div>
        </div>
      </header>

      {showAvailability && <div className="mb-6"><ProfessionalTimeOff shopId={shopId} barberId={barberId} /></div>}
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
        <section className="mb-6 rounded-2xl border border-brass/35 bg-gradient-to-r from-brass/10 to-transparent p-5">
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
          <BookingActions
            status={nextUp.status}
            busy={statusUpdatingId === nextUp.id}
            onStatusChange={(status) => updateStatus(nextUp.id, status)}
            onComplete={() => setCompletingBooking(nextUp)}
            className="mt-4 border-t border-brass/20 pt-4"
          />
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

      <details className="group mb-8 rounded-2xl border border-charcoal-light bg-charcoal-dark/30 p-4">
        <summary className="cursor-pointer list-none font-medium text-white"><span className="flex items-center justify-between">Histórico do cliente <span className="text-xs font-normal text-brass group-open:hidden">Abrir busca</span></span></summary>
        <div className="mt-4">
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
              const total = b.quoted_amount != null ? Number(b.quoted_amount) : services.reduce((sum, s) => sum + Number(s?.price || 0), 0)
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
      </details>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            dayFilter === 'today'
              ? 'Nenhum atendimento para hoje.'
              : dayFilter === 'tomorrow'
                ? 'Nenhum atendimento para amanhã.'
                : 'Nenhum agendamento pendente.'
          }
          description="Quando houver reservas confirmadas, elas aparecem aqui com horário, cliente e serviço."
        />
      ) : (
        <div className="relative space-y-3 before:absolute before:bottom-6 before:left-[4.65rem] before:top-6 before:w-px before:bg-charcoal-light sm:before:left-[5.65rem]">
          {filtered.map((b) => {
            const services = Array.from(
              new Map(
                (b.booking_services || []).map((bs) => [bs.service_id, bs.services])
              ).values()
            )
            const total = b.quoted_amount != null ? Number(b.quoted_amount) : services.reduce((sum, s) => sum + Number(s?.price || 0), 0)
            const status = b.status || 'scheduled'
            const duration =
              b.duration_minutes ||
              services.reduce((sum, s) => sum + (s?.duration_minutes || 0), 0)
            const busy = statusUpdatingId === b.id
            return (
              <article key={b.id} className="relative ml-20 rounded-2xl border border-charcoal-light bg-charcoal-dark/35 p-4 transition hover:border-brass/30 sm:ml-24">
                <div className="absolute -left-20 top-5 w-16 text-right sm:-left-24 sm:w-20"><p className="font-mono text-base text-brass">{formatTime(b.time)}</p><p className="mt-0.5 text-[10px] uppercase tracking-wider text-charcoal-muted">{formatDate(b.date)}</p></div>
                <span className="absolute -left-[0.41rem] top-7 h-3 w-3 rounded-full border-2 border-charcoal bg-brass shadow-[0_0_0_4px_rgba(214,163,61,0.12)]" />
                <div className="flex flex-wrap justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brass">{b.barbers?.name || 'Profissional'}</p>
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
                    <p className="text-sm text-white break-words">
                      {services.map((s) => s?.name).filter(Boolean).join(' · ') || 'Serviço'}
                    </p>
                  </div>
                  <p className="font-mono text-brass shrink-0">{formatPrice(total)}</p>
                </div>
                <BookingActions
                  status={b.status}
                  busy={busy}
                  onStatusChange={(nextStatus) => updateStatus(b.id, nextStatus)}
                  onComplete={() => setCompletingBooking(b)}
                  className="mt-4"
                />
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
