import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  bookingErrorMessage,
  getTotalDuration,
  getTotalPrice,
  getActiveDays,
  getScheduleForDay,
  getAvailableSlots,
  getNextDatesForDay,
  loadOccupiedSlots,
  loadPublicTimeOff,
  loadPublicShopClosures,
  isShopClosedOnDate,
  getShopClosureForDate,
  localDateIso,
} from '../../lib/booking'
import { formatPrice, formatDuration, formatPhone, formatDate } from '../../lib/format'
import {
  createPublicBooking,
  finalizePublicBooking,
  rememberBookingPhone,
} from '../../lib/secureBooking'
import { DAY_NAMES } from '../../lib/types'
import { applyWeekdayDiscount, customAnswersExtra } from '../../lib/servicePricing'
import type {
  PublicShop,
  Service,
  PublicBarber,
  BarberSchedule,
  PublicBookingSlot,
  BookingConfirmationState,
  ShopPhoto,
  BarberTimeOff,
  ShopClosure,
  ServiceBarber,
  ServiceCustomField,
  ServiceCustomFieldOption,
  ServiceWeekdayDiscount,
  CustomFieldAnswerInput,
} from '../../lib/types'
import { BrandAccent } from '../../components/BrandAccent'
import { BookingStepper } from '../../components/public/BookingStepper'
import { PageLoader } from '../../components/public/PageLoader'
import { TimeSlotGrid } from '../../components/TimeSlotGrid'
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

  const [shop, setShop] = useState<PublicShop | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<PublicBarber[]>([])
  const [schedules, setSchedules] = useState<BarberSchedule[]>([])
  const [occupiedSlots, setOccupiedSlots] = useState<PublicBookingSlot[]>([])
  const [timeOff, setTimeOff] = useState<BarberTimeOff[]>([])
  const [shopClosures, setShopClosures] = useState<ShopClosure[]>([])
  const [serviceBarbers, setServiceBarbers] = useState<ServiceBarber[]>([])
  const [customFields, setCustomFields] = useState<ServiceCustomField[]>([])
  const [customOptions, setCustomOptions] = useState<ServiceCustomFieldOption[]>([])
  const [weekdayDiscounts, setWeekdayDiscounts] = useState<ServiceWeekdayDiscount[]>([])
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [shopStats, setShopStats] = useState<RatingStats | null>(null)
  const [barberStats, setBarberStats] = useState<Record<string, BarberRatingStats>>({})

  const [step, setStep] = useState<Step>(1)
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set())
  const [customAnswers, setCustomAnswers] = useState<CustomFieldAnswerInput[]>([])
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
        .from('public_shops')
        .select('*')
        .eq('id', shopId)
        .neq('subscription_status', 'blocked')
        .single()

      if (!shopData) {
        setLoading(false)
        return
      }

      if (shopData.segment === 'pet') {
        navigate(`/pet/${shopId}`, { replace: true })
        return
      }

      const [{ data: svc }, { data: barb }, { data: ph }, { data: mappings }, stats, bStats] = await Promise.all([
        supabase.from('services').select('*').eq('shop_id', shopId).order('name'),
        supabase.from('public_barbers').select('*').eq('shop_id', shopId).order('name'),
        supabase
          .from('shop_photos')
          .select('*')
          .eq('shop_id', shopId)
          .order('sort_order')
          .limit(6),
        supabase.from('service_barbers').select('*').eq('shop_id', shopId),
        fetchShopRatingStats(shopId!),
        fetchBarberRatingStatsMap(shopId!),
      ])

      const serviceList = svc || []
      if (serviceList.length > 0) {
        const serviceIds = serviceList.map((service) => service.id)
        const [{ data: fields }, { data: discounts }] = await Promise.all([
          supabase.from('service_custom_fields').select('*').in('service_id', serviceIds).order('sort_order'),
          supabase.from('service_weekday_discounts').select('*').in('service_id', serviceIds),
        ])
        const fieldList = (fields as ServiceCustomField[]) || []
        let optionList: ServiceCustomFieldOption[] = []
        if (fieldList.length > 0) {
          const { data } = await supabase
            .from('service_custom_field_options')
            .select('*')
            .in('field_id', fieldList.map((field) => field.id))
            .order('sort_order')
          optionList = (data as ServiceCustomFieldOption[]) || []
        }
        setCustomFields(fieldList)
        setCustomOptions(optionList)
        setWeekdayDiscounts((discounts as ServiceWeekdayDiscount[]) || [])
      }

      const barberIds = (barb || []).map((b) => b.id)
      let sched: BarberSchedule[] = []
      if (barberIds.length > 0) {
        const { data } = await supabase
          .from('barber_schedule')
          .select('*')
          .in('barber_id', barberIds)
        sched = data || []
      }

      let slots: PublicBookingSlot[] = []
      let unavailable: BarberTimeOff[] = []
      let closures: ShopClosure[] = []
      try {
        ;[slots, unavailable, closures] = await Promise.all([
          loadOccupiedSlots(shopId!),
          loadPublicTimeOff(shopId!),
          loadPublicShopClosures(shopId!),
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a agenda.')
      }

      setShop(shopData)
      setServices(serviceList)
      setBarbers(barb || [])
      setSchedules(sched)
      setOccupiedSlots(slots)
      setTimeOff(unavailable)
      setShopClosures(closures)
      setServiceBarbers((mappings as ServiceBarber[]) || [])
      setPhotos((ph as ShopPhoto[]) || [])
      setShopStats(stats)
      setBarberStats(bStats)
      setLoading(false)
    }
    load()
  }, [shopId, navigate])

  useEffect(() => {
    if (!shopId || step !== 3) return
    Promise.all([loadOccupiedSlots(shopId), loadPublicTimeOff(shopId), loadPublicShopClosures(shopId)])
      .then(([slots, unavailable, closures]) => {
        setOccupiedSlots(slots)
        setTimeOff(unavailable)
        setShopClosures(closures)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Não foi possível atualizar a agenda.')
      })
  }, [shopId, step])

  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.has(s.id)),
    [services, selectedServiceIds]
  )
  const activeCustomFields = useMemo(
    () => customFields.filter((field) => selectedServiceIds.has(field.service_id)),
    [customFields, selectedServiceIds]
  )
  const selectedCustomAnswers = useMemo(
    () => customAnswers.filter((answer) => activeCustomFields.some((field) => field.id === answer.field_id)),
    [customAnswers, activeCustomFields]
  )
  const baseServicesAmount = getTotalPrice(selectedServices)
  const discountedServicesAmount = selectedServices.reduce(
    (sum, service) => sum + applyWeekdayDiscount(Number(service.price), service.id, selectedDate, weekdayDiscounts),
    0
  )
  const extrasAmount = customAnswersExtra(selectedCustomAnswers, customOptions)
  const discountAmount = Math.max(0, baseServicesAmount - discountedServicesAmount)
  const quotedTotal = discountedServicesAmount + extrasAmount
  const eligibleBarbers = useMemo(() => {
    if (selectedServiceIds.size === 0) return barbers
    return barbers.filter((professional) =>
      Array.from(selectedServiceIds).every((serviceId) => {
        const restrictedTo = serviceBarbers.filter((item) => item.service_id === serviceId)
        return restrictedTo.length === 0 || restrictedTo.some((item) => item.barber_id === professional.id)
      })
    )
  }, [barbers, selectedServiceIds, serviceBarbers])

  useEffect(() => {
    if (selectedBarberId && !eligibleBarbers.some((item) => item.id === selectedBarberId)) {
      setSelectedBarberId(eligibleBarbers.length === 1 ? eligibleBarbers[0].id : null)
      setSelectedDay(null)
      setSelectedDate(null)
      setSelectedTime(null)
    } else if (!selectedBarberId && eligibleBarbers.length === 1) {
      setSelectedBarberId(eligibleBarbers[0].id)
    }
  }, [eligibleBarbers, selectedBarberId])

  const selectedBarber = barbers.find((b) => b.id === selectedBarberId)
  const barberSchedules = schedules.filter((s) => s.barber_id === selectedBarberId)
  const activeDays = getActiveDays(barberSchedules)

  const availableDates = selectedDay !== null
    ? getNextDatesForDay(selectedDay, 12)
        .filter((date) => !getShopClosureForDate(shopClosures, date))
        .slice(0, 8)
    : []

  const daySchedule =
    selectedDay !== null ? getScheduleForDay(barberSchedules, selectedDay) : undefined

  const availableSlots =
    daySchedule && selectedDate && selectedBarberId
      ? getAvailableSlots(
          daySchedule,
          occupiedSlots.filter((s) => s.barber_id === selectedBarberId),
          selectedServices,
          selectedDate,
          undefined,
          timeOff,
          shopClosures
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

  const setCustomAnswer = (fieldId: string, value: Partial<CustomFieldAnswerInput>) => {
    setCustomAnswers((current) => {
      const exists = current.some((answer) => answer.field_id === fieldId)
      return exists
        ? current.map((answer) => answer.field_id === fieldId ? { ...answer, ...value } : answer)
        : [...current, { field_id: fieldId, ...value }]
    })
  }

  const continueFromServices = () => {
    const missing = activeCustomFields.find((field) => {
      if (!field.required) return false
      const answer = selectedCustomAnswers.find((item) => item.field_id === field.id)
      return field.field_type === 'single_choice' ? !answer?.option_id : !answer?.value?.trim()
    })
    if (missing) {
      setError(`Responda: ${missing.label}`)
      return
    }
    setError('')
    setStep(2)
  }

  const handleSubmit = async () => {
    if (!shop || !selectedBarberId || !selectedDate || !selectedTime) return
    if (!clientName.trim() || !clientPhone.trim()) {
      setError('Informe nome e WhatsApp.')
      return
    }

    setSubmitting(true)
    setError('')

    // Garante perfil em clients quando o usuário está logado (necessário para FK e avaliações)
    if (user) {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      if (!existingClient) {
        const { error: clientError } = await supabase.from('clients').insert({
          id: user.id,
          name: clientName.trim() || 'Cliente',
          phone: clientPhone.replace(/\D/g, '') || null,
        })
        if (clientError) {
          setError(clientError.message)
          setSubmitting(false)
          return
        }
      }
    }

    const normalizedPhone = clientPhone.replace(/\D/g, '')
    let bookingId: string
    try {
      bookingId = await createPublicBooking({
        shopId: shop.id,
        barberId: selectedBarberId,
        clientName,
        clientPhone: normalizedPhone,
        date: selectedDate,
        time: selectedTime,
      })
      await finalizePublicBooking({
        bookingId,
        phone: normalizedPhone,
        serviceIds: selectedServices.map((service) => service.id),
        customAnswers: selectedCustomAnswers,
      })
    } catch (err) {
      const msg = bookingErrorMessage(err)
      setError(msg)
      setSubmitting(false)
      if (/horário|reservado|fechado/i.test(msg) && shopId) {
        setSelectedTime(null)
        setStep(3)
        try {
          const [slots, closures] = await Promise.all([
            loadOccupiedSlots(shopId),
            loadPublicShopClosures(shopId),
          ])
          setOccupiedSlots(slots)
          setShopClosures(closures)
        } catch {
          /* already showing booking conflict */
        }
      }
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
      clientPhone: normalizedPhone,
      services: selectedServices,
      quotedAmount: quotedTotal,
      discountAmount,
      extrasAmount,
    }

    rememberBookingPhone(bookingId, normalizedPhone)
    navigate(`/confirmacao/${bookingId}`, { state: confirmationState })
  }

  if (loading) return <PageLoader label="Carregando agendamento" />
  if (!shop) return <p className="text-center text-ink-muted">Estabelecimento não encontrado.</p>

  const today = localDateIso()
  const todayClosure = getShopClosureForDate(shopClosures, today)
  const closedToday = isShopClosedOnDate(schedules, timeOff, barbers.map((item) => item.id), today, shopClosures)

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
        <BrandAccent className="mt-2 max-w-md" segment="barbershop" />
        {closedToday && (
          <div role="status" className="mt-5 rounded-2xl border border-brass/35 bg-brass/10 px-5 py-4 text-center">
            <p className="text-base font-semibold text-ink">Estamos fechados hoje.</p>
            <p className="mt-1 text-sm text-ink-muted">
              {todayClosure
                ? `${todayClosure.label}. Fechado até ${formatDate(todayClosure.ends_on)}. Consulte os próximos dias disponíveis.`
                : 'Volte amanhã! Você ainda pode consultar os próximos dias disponíveis.'}
            </p>
          </div>
        )}
      </div>

      <BookingStepper steps={steps} current={step} />

      <div className="rounded-2xl border border-paper-dark bg-white p-6 shadow-sm">
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
            {activeCustomFields.length > 0 && (
              <div className="mt-5 space-y-4 rounded-2xl border border-paper-dark p-4">
                <div>
                  <h3 className="font-semibold">Detalhes do serviço</h3>
                  <p className="text-xs text-ink-muted">Responda para o profissional preparar o atendimento.</p>
                </div>
                {activeCustomFields.map((field) => {
                  const answer = selectedCustomAnswers.find((item) => item.field_id === field.id)
                  return (
                    <label key={field.id} className="block text-sm font-medium">
                      {field.label}{field.required && <span className="text-red-500"> *</span>}
                      {field.field_type === 'single_choice' ? (
                        <select
                          value={answer?.option_id || ''}
                          onChange={(event) => setCustomAnswer(field.id, { option_id: event.target.value || null, value: null })}
                          className="mt-1.5 min-h-11 w-full rounded-xl border border-paper-dark bg-white px-3 text-sm focus:border-brass focus:outline-none"
                        >
                          <option value="">Selecione</option>
                          {customOptions.filter((option) => option.field_id === field.id).map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}{Number(option.price_delta) > 0 ? ` (+${formatPrice(Number(option.price_delta))})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={answer?.value || ''}
                          onChange={(event) => setCustomAnswer(field.id, { value: event.target.value, option_id: null })}
                          maxLength={500}
                          className="mt-1.5 min-h-11 w-full rounded-xl border border-paper-dark px-3 text-sm focus:border-brass focus:outline-none"
                        />
                      )}
                    </label>
                  )
                })}
              </div>
            )}
            {selectedServices.length > 0 && (
              <div className="mt-6 flex justify-between rounded-lg bg-paper p-4 font-mono">
                <span>Total: {formatDuration(getTotalDuration(selectedServices))}</span>
                <span className="text-brass font-semibold">
                  {formatPrice(quotedTotal)}
                </span>
              </div>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <button
              onClick={continueFromServices}
              disabled={selectedServices.length === 0}
              className="btn-primary mt-6 w-full"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-2xl mb-4">Escolha o profissional</h2>
            <div className="space-y-3">
              {eligibleBarbers.map((b) => {
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
              {eligibleBarbers.length === 0 && (
                <p className="rounded-xl border border-brass/30 bg-brass/5 p-4 text-sm text-ink-muted">
                  Nenhum profissional atende essa combinação. Volte e escolha outra combinação de serviços.
                </p>
              )}
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
                          ? 'bg-brass text-charcoal'
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
              <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedBarberId || selectedDay === null}
                className="btn-primary flex-1"
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
                  className={`rounded-xl border px-3.5 py-2.5 text-sm transition-all ${
                    selectedDate === d
                      ? 'border-brass bg-brass font-medium text-charcoal shadow-sm'
                      : 'border-transparent bg-paper text-ink hover:border-brass/40 hover:bg-paper-dark'
                  }`}
                >
                  <span className="block text-[11px] uppercase tracking-wide opacity-70">
                    {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </span>
                  <span className="font-mono">
                    {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </button>
              ))}
            </div>

            {selectedDate && (
              <div>
                <h3 className="mb-3 font-medium">Horários disponíveis</h3>
                <TimeSlotGrid
                  slots={availableSlots}
                  selected={selectedTime}
                  onSelect={setSelectedTime}
                />
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1">
                Voltar
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!selectedDate || !selectedTime}
                className="btn-primary flex-1"
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
              {discountAmount > 0 && <p className="mt-2 text-emerald-700">Desconto do dia: − {formatPrice(discountAmount)}</p>}
              {extrasAmount > 0 && <p className="mt-1 text-ink-muted">Adicionais: + {formatPrice(extrasAmount)}</p>}
              <p className="mt-2 font-mono text-brass">
                {formatPrice(quotedTotal)}
              </p>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(3)} className="btn-secondary flex-1">
                Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex-1"
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
