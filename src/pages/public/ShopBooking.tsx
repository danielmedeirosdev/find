import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getTotalDuration,
  getTotalPrice,
  getActiveDays,
  getScheduleForDay,
  getAvailableSlots,
  getNextDatesForDay,
} from '../../lib/booking'
import { formatPrice, formatDuration, formatPhone } from '../../lib/format'
import { DAY_NAMES } from '../../lib/types'
import type {
  Shop,
  Service,
  Barber,
  BarberSchedule,
  PublicBookingSlot,
  BookingConfirmationState,
  ShopPhoto,
} from '../../lib/types'
import { BarberPole } from '../../components/BarberPole'
import { DefaultAvatar } from '../../components/MediaUI'
import { RatingBadge } from '../../components/reviews/StarRating'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchBarberRatingStatsMap,
  fetchShopRatingStats,
} from '../../lib/reviews'
import type { BarberRatingStats, RatingStats } from '../../lib/types'

type Step = 1 | 2 | 3 | 4

export function ShopBooking() {
  const { shopId } = useParams<{ shopId: string }>()
  const navigate = useNavigate()
  const { user, clientProfile } = useAuth()

  const [shop, setShop] = useState<Shop | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [schedules, setSchedules] = useState<BarberSchedule[]>([])
  const [occupiedSlots, setOccupiedSlots] = useState<PublicBookingSlot[]>([])
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [shopStats, setShopStats] = useState<RatingStats | null>(null)
  const [barberStats, setBarberStats] = useState<Record<string, BarberRatingStats>>({})

  const [step, setStep] = useState<Step>(1)
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set())
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clientProfile) {
      setClientName(clientProfile.name)
      setClientPhone(clientProfile.phone || '')
    }
  }, [clientProfile])

  useEffect(() => {
    if (!shopId) return
    async function load() {
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .neq('subscription_status', 'blocked')
        .single()

      if (!shopData) {
        setLoading(false)
        return
      }

      const [{ data: svc }, { data: barb }, { data: ph }, stats, bStats] = await Promise.all([
        supabase.from('services').select('*').eq('shop_id', shopId).order('name'),
        supabase.from('barbers').select('*').eq('shop_id', shopId).order('name'),
        supabase
          .from('shop_photos')
          .select('*')
          .eq('shop_id', shopId)
          .order('sort_order')
          .limit(6),
        fetchShopRatingStats(shopId!),
        fetchBarberRatingStatsMap(shopId!),
      ])

      const barberIds = (barb || []).map((b) => b.id)
      let sched: BarberSchedule[] = []
      if (barberIds.length > 0) {
        const { data } = await supabase
          .from('barber_schedule')
          .select('*')
          .in('barber_id', barberIds)
        sched = data || []
      }

      const { data: slots } = await supabase
        .from('public_booking_slots')
        .select('shop_id, barber_id, date, time')
        .eq('shop_id', shopId)
        .gte('date', new Date().toISOString().slice(0, 10))

      setShop(shopData)
      setServices(svc || [])
      setBarbers(barb || [])
      setSchedules(sched)
      setOccupiedSlots(slots || [])
      setPhotos((ph as ShopPhoto[]) || [])
      setShopStats(stats)
      setBarberStats(bStats)
      setLoading(false)
    }
    load()
  }, [shopId])

  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.has(s.id)),
    [services, selectedServiceIds]
  )

  const selectedBarber = barbers.find((b) => b.id === selectedBarberId)
  const barberSchedules = schedules.filter((s) => s.barber_id === selectedBarberId)
  const activeDays = getActiveDays(barberSchedules)

  const availableDates = selectedDay !== null ? getNextDatesForDay(selectedDay) : []

  const daySchedule =
    selectedDay !== null ? getScheduleForDay(barberSchedules, selectedDay) : undefined

  const availableSlots =
    daySchedule && selectedDate && selectedBarberId
      ? getAvailableSlots(
          daySchedule,
          occupiedSlots.filter((s) => s.barber_id === selectedBarberId),
          selectedServices,
          selectedDate
        )
      : []

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!shop || !selectedBarberId || !selectedDate || !selectedTime) return
    if (!clientName.trim() || !clientPhone.trim()) {
      setError('Informe nome e WhatsApp.')
      return
    }

    setSubmitting(true)
    setError('')

    const { data: booking, error: bkError } = await supabase
      .from('bookings')
      .insert({
        shop_id: shop.id,
        barber_id: selectedBarberId,
        client_id: user?.id || null,
        client_name: clientName.trim(),
        client_phone: clientPhone.replace(/\D/g, ''),
        date: selectedDate,
        time: selectedTime,
      })
      .select()
      .single()

    if (bkError || !booking) {
      setError(bkError?.message || 'Erro ao criar agendamento. Tente outro horário.')
      setSubmitting(false)
      return
    }

    const serviceRows = selectedServices.map((s) => ({
      booking_id: booking.id,
      service_id: s.id,
    }))

    const { error: svcError } = await supabase.from('booking_services').insert(serviceRows)

    if (svcError) {
      setError('Erro ao salvar serviços.')
      setSubmitting(false)
      return
    }

    const confirmationState: BookingConfirmationState = {
      shopName: shop.name,
      shopAddress: shop.address,
      shopPhone: shop.phone,
      barberName: selectedBarber?.name || '',
      date: selectedDate,
      time: selectedTime,
      clientName: clientName.trim(),
      clientPhone: clientPhone.replace(/\D/g, ''),
      services: selectedServices,
    }

    navigate(`/confirmacao/${booking.id}`, { state: confirmationState })
  }

  if (loading) return <p className="text-center text-ink-muted">Carregando...</p>
  if (!shop) return <p className="text-center text-ink-muted">Barbearia não encontrada.</p>

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Serviços' },
    { n: 2, label: 'Profissional' },
    { n: 3, label: 'Horário' },
    { n: 4, label: 'Confirmar' },
  ]

  return (
    <div>
      <div className="mb-8">
        <div className="mb-4 flex items-start gap-4">
          {shop.logo_url && (
            <img
              src={shop.logo_url}
              alt=""
              className="h-16 w-16 rounded-xl object-cover border border-paper-dark"
            />
          )}
          <div>
            <h1 className="font-display text-4xl text-ink">{shop.name}</h1>
            {shop.slogan && <p className="text-ink-muted italic">{shop.slogan}</p>}
            {shopStats && shopStats.review_count > 0 && (
              <RatingBadge
                avg={Number(shopStats.avg_rating)}
                count={shopStats.review_count}
                className="mt-2"
              />
            )}
            {shop.address && <p className="text-sm text-ink-muted mt-1">{shop.address}</p>}
            {shop.hours_text && (
              <p className="text-sm font-mono text-ink-muted mt-1">{shop.hours_text}</p>
            )}
          </div>
        </div>
        {photos.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {photos.map((p) => (
              <img
                key={p.id}
                src={p.url}
                alt=""
                loading="lazy"
                className="h-20 w-28 shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
        <BarberPole className="mt-2 max-w-md" />
      </div>

      <div className="mb-8 flex gap-2">
        {steps.map(({ n, label }) => (
          <div
            key={n}
            className={`flex-1 rounded-t-lg px-3 py-2 text-center text-sm font-medium ${
              step === n
                ? 'bg-brass text-white'
                : step > n
                  ? 'bg-paper-dark text-ink'
                  : 'bg-paper-dark/50 text-ink-muted'
            }`}
          >
            {n}. {label}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-paper-dark bg-white p-6">
        {step === 1 && (
          <div>
            <h2 className="font-display text-2xl mb-4">Escolha os serviços</h2>
            <div className="space-y-3">
              {services.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors ${
                    selectedServiceIds.has(s.id)
                      ? 'border-brass bg-brass/5'
                      : 'border-paper-dark hover:border-brass/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.has(s.id)}
                      onChange={() => toggleService(s.id)}
                      className="h-4 w-4 accent-brass"
                    />
                    <span className="font-medium">{s.name}</span>
                  </div>
                  <div className="text-right font-mono text-sm">
                    <div className="text-brass">{formatPrice(Number(s.price))}</div>
                    <div className="text-ink-muted">{formatDuration(s.duration_minutes)}</div>
                  </div>
                </label>
              ))}
            </div>
            {selectedServices.length > 0 && (
              <div className="mt-6 flex justify-between rounded-lg bg-paper p-4 font-mono">
                <span>Total: {formatDuration(getTotalDuration(selectedServices))}</span>
                <span className="text-brass font-semibold">
                  {formatPrice(getTotalPrice(selectedServices))}
                </span>
              </div>
            )}
            <button
              onClick={() => setStep(2)}
              disabled={selectedServices.length === 0}
              className="mt-6 w-full rounded-lg bg-brass py-3 font-semibold text-white disabled:opacity-40"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-2xl mb-4">Escolha o profissional</h2>
            <div className="space-y-3">
              {barbers.map((b) => {
                const days = getActiveDays(schedules.filter((s) => s.barber_id === b.id))
                const stats = barberStats[b.id]
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBarberId(b.id)
                      setSelectedDay(null)
                      setSelectedDate(null)
                      setSelectedTime(null)
                    }}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selectedBarberId === b.id
                        ? 'border-brass bg-brass/5'
                        : 'border-paper-dark hover:border-brass/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {b.photo_url ? (
                        <img
                          src={b.photo_url}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <DefaultAvatar name={b.name} className="h-12 w-12 text-lg" />
                      )}
                      <div>
                        <div className="font-medium">{b.name}</div>
                        {b.role && <div className="text-xs text-ink-muted">{b.role}</div>}
                        {stats && stats.review_count > 0 && (
                          <RatingBadge
                            avg={Number(stats.avg_rating)}
                            count={stats.review_count}
                            className="mt-1"
                          />
                        )}
                        <div className="text-sm text-ink-muted mt-1">
                          Atende: {days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ') || '—'}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            {selectedBarberId && activeDays.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium mb-3">Dia da semana</h3>
                <div className="flex flex-wrap gap-2">
                  {activeDays.map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setSelectedDay(d)
                        setSelectedDate(null)
                        setSelectedTime(null)
                      }}
                      className={`rounded-lg px-4 py-2 text-sm ${
                        selectedDay === d
                          ? 'bg-brass text-white'
                          : 'bg-paper text-ink hover:bg-paper-dark'
                      }`}
                    >
                      {DAY_NAMES[d]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-lg border py-3">
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedBarberId || selectedDay === null}
                className="flex-1 rounded-lg bg-brass py-3 font-semibold text-white disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-display text-2xl mb-4">Escolha data e horário</h2>
            <p className="text-sm text-ink-muted mb-4">
              Com {selectedBarber?.name} · {selectedDay !== null ? DAY_NAMES[selectedDay] : ''}
            </p>

            <div className="mb-6 flex flex-wrap gap-2">
              {availableDates.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setSelectedDate(d)
                    setSelectedTime(null)
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-mono ${
                    selectedDate === d
                      ? 'bg-brass text-white'
                      : 'bg-paper text-ink hover:bg-paper-dark'
                  }`}
                >
                  {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </button>
              ))}
            </div>

            {selectedDate && (
              <div>
                <h3 className="font-medium mb-3">Horários disponíveis</h3>
                {availableSlots.length === 0 ? (
                  <p className="text-ink-muted text-sm">Nenhum horário disponível nesta data.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {availableSlots.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={`rounded-lg py-2 font-mono text-sm ${
                          selectedTime === t
                            ? 'bg-brass text-white'
                            : 'bg-paper hover:bg-paper-dark'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 rounded-lg border py-3">
                Voltar
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!selectedDate || !selectedTime}
                className="flex-1 rounded-lg bg-brass py-3 font-semibold text-white disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="font-display text-2xl mb-4">Seus dados</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-lg border border-paper-dark px-4 py-2 focus:border-brass focus:outline-none"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                  className="w-full rounded-lg border border-paper-dark px-4 py-2 focus:border-brass focus:outline-none"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-paper p-4 text-sm">
              <p>
                <strong>{selectedBarber?.name}</strong> ·{' '}
                {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}{' '}
                às <span className="font-mono">{selectedTime}</span>
              </p>
              <p className="mt-2 text-ink-muted">
                {selectedServices.map((s) => s.name).join(', ')}
              </p>
              <p className="mt-2 font-mono text-brass">
                {formatPrice(getTotalPrice(selectedServices))}
              </p>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 rounded-lg border py-3">
                Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-brass py-3 font-semibold text-white disabled:opacity-40"
              >
                {submitting ? 'Confirmando...' : 'Confirmar agendamento'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
