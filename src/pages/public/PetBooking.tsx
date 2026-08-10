import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getActiveDays,
  getScheduleForDay,
  getAvailableSlots,
  getNextDatesForDay,
} from '../../lib/booking'
import { getPetServicesDuration, getPetServicesPrice, petSizeLabel } from '../../lib/pet'
import { notifyCustomerWhatsApp, notifyShopOwner } from '../../lib/notifications'
import { formatDuration, formatPhone, formatPrice } from '../../lib/format'
import { DefaultAvatar } from '../../components/MediaUI'
import { BrandAccent } from '../../components/BrandAccent'
import { SegmentProvider } from '../../contexts/SegmentContext'
import { DAY_NAMES, PET_SIZES } from '../../lib/types'
import type {
  Barber,
  BarberSchedule,
  BookingConfirmationState,
  NoShowPolicy,
  Pet,
  PetSize,
  PublicBookingSlot,
  Service,
  ServiceSizeRule,
  Shop,
  ShopCustomer,
} from '../../lib/types'

type Step = 1 | 2 | 3 | 4 | 5

export function PetBooking() {
  const { shopId } = useParams<{ shopId: string }>()
  const navigate = useNavigate()

  const [shop, setShop] = useState<Shop | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [rules, setRules] = useState<ServiceSizeRule[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [schedules, setSchedules] = useState<BarberSchedule[]>([])
  const [occupiedSlots, setOccupiedSlots] = useState<PublicBookingSlot[]>([])
  const [loading, setLoading] = useState(true)

  const [step, setStep] = useState<Step>(1)
  const [phone, setPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customer, setCustomer] = useState<ShopCustomer | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [creatingPet, setCreatingPet] = useState(false)
  const [newPetName, setNewPetName] = useState('')
  const [newPetSize, setNewPetSize] = useState<PetSize>('medio')
  const [newPetBreed, setNewPetBreed] = useState('')

  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set())
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [lookupDone, setLookupDone] = useState(false)
  const [noShowPolicy, setNoShowPolicy] = useState<NoShowPolicy | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  useEffect(() => {
    if (!shopId) return
    async function load() {
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .eq('segment', 'pet')
        .neq('subscription_status', 'blocked')
        .maybeSingle()

      if (!shopData) {
        setLoading(false)
        return
      }

      const [{ data: svc }, { data: barb }] = await Promise.all([
        supabase.from('services').select('*').eq('shop_id', shopId).order('name'),
        supabase.from('barbers').select('*').eq('shop_id', shopId).order('name'),
      ])

      const serviceList = svc || []
      let sizeRules: ServiceSizeRule[] = []
      if (serviceList.length > 0) {
        const { data: r } = await supabase
          .from('service_size_rules')
          .select('*')
          .in(
            'service_id',
            serviceList.map((s) => s.id)
          )
        sizeRules = (r as ServiceSizeRule[]) || []
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

      const { data: slots } = await supabase
        .from('public_booking_slots')
        .select('shop_id, barber_id, date, time, duration_minutes')
        .eq('shop_id', shopId)
        .gte('date', new Date().toISOString().slice(0, 10))

      const { data: policy } = await supabase
        .from('no_show_policies')
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle()

      setShop(shopData)
      setServices(serviceList)
      setRules(sizeRules)
      setBarbers(barb || [])
      setSchedules(sched)
      setOccupiedSlots((slots as PublicBookingSlot[]) || [])
      setNoShowPolicy((policy as NoShowPolicy) || null)
      if ((barb || []).length === 1) setSelectedBarberId(barb![0].id)
      setLoading(false)
    }
    load()
  }, [shopId])

  const selectedPet = pets.find((p) => p.id === selectedPetId) || null
  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.has(s.id)),
    [services, selectedServiceIds]
  )

  const duration = selectedPet
    ? getPetServicesDuration(selectedServices, selectedPet.size, rules)
    : 0
  const totalPrice = selectedPet
    ? getPetServicesPrice(selectedServices, selectedPet.size, rules)
    : 0

  const selectedBarber = barbers.find((b) => b.id === selectedBarberId)
  const barberSchedules = schedules.filter((s) => s.barber_id === selectedBarberId)
  const activeDays = getActiveDays(barberSchedules)
  const availableDates = selectedDay !== null ? getNextDatesForDay(selectedDay) : []
  const daySchedule =
    selectedDay !== null ? getScheduleForDay(barberSchedules, selectedDay) : undefined

  const availableSlots =
    daySchedule && selectedDate && selectedBarberId && duration > 0
      ? getAvailableSlots(
          daySchedule,
          occupiedSlots.filter((s) => s.barber_id === selectedBarberId),
          selectedServices,
          selectedDate,
          duration
        )
      : []

  const lookupCustomer = async () => {
    if (!shopId) return
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Informe um WhatsApp válido.')
      return
    }
    setError('')
    const { data } = await supabase
      .from('shop_customers')
      .select('*')
      .eq('shop_id', shopId)
      .eq('phone', digits)
      .maybeSingle()

    if (data) {
      setCustomer(data as ShopCustomer)
      setCustomerName(data.name)
      const { data: petList } = await supabase
        .from('pets')
        .select('*')
        .eq('shop_id', shopId)
        .eq('customer_id', data.id)
        .order('name')
      setPets((petList as Pet[]) || [])
    } else {
      setCustomer(null)
      setPets([])
    }
    setLookupDone(true)
    setStep(2)
  }

  const ensureCustomer = async (): Promise<ShopCustomer | null> => {
    if (!shopId) return null
    const digits = phone.replace(/\D/g, '')
    if (customer) return customer
    if (!customerName.trim()) {
      setError('Informe seu nome.')
      return null
    }
    const { data, error: err } = await supabase
      .from('shop_customers')
      .insert({
        shop_id: shopId,
        name: customerName.trim(),
        phone: digits,
      })
      .select('*')
      .single()
    if (err || !data) {
      // race: already exists
      const { data: again } = await supabase
        .from('shop_customers')
        .select('*')
        .eq('shop_id', shopId)
        .eq('phone', digits)
        .maybeSingle()
      if (again) {
        setCustomer(again as ShopCustomer)
        return again as ShopCustomer
      }
      setError(err?.message || 'Erro ao salvar cliente.')
      return null
    }
    setCustomer(data as ShopCustomer)
    return data as ShopCustomer
  }

  const createPet = async () => {
    const cust = await ensureCustomer()
    if (!cust || !shopId || !newPetName.trim()) return
    const { data, error: err } = await supabase
      .from('pets')
      .insert({
        shop_id: shopId,
        customer_id: cust.id,
        name: newPetName.trim(),
        size: newPetSize,
        breed: newPetBreed.trim() || null,
        species: 'cao',
      })
      .select('*')
      .single()
    if (err || !data) {
      setError(err?.message || 'Erro ao cadastrar pet.')
      return
    }
    setPets((prev) => [...prev, data as Pet])
    setSelectedPetId(data.id)
    setCreatingPet(false)
    setNewPetName('')
    setNewPetBreed('')
    setStep(3)
  }

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!shop || !selectedBarberId || !selectedDate || !selectedTime || !selectedPet) return
    const cust = await ensureCustomer()
    if (!cust) return

    if (noShowPolicy?.enabled && !acceptedTerms) {
      setError('Aceite a política de faltas para confirmar.')
      return
    }

    setSubmitting(true)
    setError('')

    const { data: booking, error: bkError } = await supabase
      .from('bookings')
      .insert({
        shop_id: shop.id,
        barber_id: selectedBarberId,
        client_id: null,
        client_name: cust.name,
        client_phone: cust.phone,
        date: selectedDate,
        time: selectedTime,
        pet_id: selectedPet.id,
        shop_customer_id: cust.id,
        duration_minutes: duration,
        status: 'scheduled',
      })
      .select()
      .single()

    if (bkError || !booking) {
      setError(bkError?.message || 'Horário indisponível. Tente outro.')
      setSubmitting(false)
      return
    }

    if (selectedServices.length > 0) {
      await supabase.from('booking_services').insert(
        selectedServices.map((s) => ({
          booking_id: booking.id,
          service_id: s.id,
        }))
      )
    }

    if (noShowPolicy?.enabled) {
      await supabase.from('terms_acceptances').insert({
        shop_id: shop.id,
        booking_id: booking.id,
        shop_customer_id: cust.id,
        phone: cust.phone,
        policy_version: noShowPolicy.terms_version,
        terms_text: noShowPolicy.terms_text,
        fee_amount: noShowPolicy.fee_amount,
        hours_before: noShowPolicy.hours_before,
      })
    }

    await notifyShopOwner({
      shopId: shop.id,
      kind: 'new_booking',
      title: 'Novo agendamento',
      body: `${selectedPet.name} · ${cust.name} · ${selectedDate} ${selectedTime}`,
      bookingId: booking.id,
    })

    await notifyCustomerWhatsApp({
      toPhone: cust.phone,
      kind: 'booking_confirmation',
      body: `Agendamento confirmado no ${shop.name}: ${selectedPet.name} em ${selectedDate} às ${selectedTime}.`,
      shopId: shop.id,
      bookingId: booking.id,
    })

    const confirmationState: BookingConfirmationState = {
      shopName: shop.name,
      shopAddress: shop.address,
      shopPhone: shop.phone,
      barberName: selectedBarber?.name || '',
      date: selectedDate,
      time: selectedTime,
      clientName: cust.name,
      clientPhone: cust.phone,
      services: selectedServices.map((s) => ({
        ...s,
        price: getPetServicesPrice([s], selectedPet.size, rules),
        duration_minutes: getPetServicesDuration([s], selectedPet.size, rules),
      })),
      petName: selectedPet.name,
      petSize: petSizeLabel(selectedPet.size),
      durationMinutes: duration,
    }

    navigate(`/confirmacao/${booking.id}`, { state: confirmationState })
  }

  if (loading) return <p className="text-center text-ink-muted">Carregando...</p>
  if (!shop) return <p className="text-center text-ink-muted">Pet shop não encontrado.</p>

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Telefone' },
    { n: 2, label: 'Pet' },
    { n: 3, label: 'Serviço' },
    { n: 4, label: 'Horário' },
    { n: 5, label: 'Confirmar' },
  ]

  return (
    <SegmentProvider segment="pet">
    <div className="pet-hero-glow -mx-4 rounded-2xl px-4 py-2">
      <div className="mb-6 flex items-start gap-3">
        {shop.logo_url && (
          <img src={shop.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
        )}
        <div>
          <p className="text-xs uppercase tracking-widest text-brass font-medium">FIND PET</p>
          <h1 className="font-display text-3xl text-ink">{shop.name}</h1>
          {shop.slogan && <p className="text-ink-muted italic text-sm">{shop.slogan}</p>}
          <BrandAccent className="mt-3 max-w-xs" height="h-1.5" segment="pet" />
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto">
        {steps.map(({ n, label }) => (
          <div
            key={n}
            className={`shrink-0 rounded-t-lg px-3 py-2 text-center text-xs font-medium sm:text-sm ${
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
          <div className="space-y-4">
            <h2 className="font-display text-2xl">Seu WhatsApp</h2>
            <p className="text-sm text-ink-muted">
              Usamos o telefone para encontrar seus pets cadastrados.
            </p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="Ex: (11) 99999-9999"
              className="w-full rounded-lg border border-paper-dark px-4 py-3 focus:border-brass focus:outline-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={lookupCustomer}
              className="w-full rounded-lg bg-brass py-3 font-semibold text-white"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-2xl mb-2">Qual pet?</h2>
            {!customer && (
              <div className="mb-4">
                <label className="block text-sm mb-1">Seu nome</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  className="w-full rounded-lg border border-paper-dark px-4 py-2 focus:border-brass focus:outline-none"
                />
              </div>
            )}
            {lookupDone && customer && (
              <p className="text-sm text-ink-muted mb-4">Olá, {customer.name}!</p>
            )}

            <div className="space-y-3 mb-4">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => {
                    setSelectedPetId(pet.id)
                    setCreatingPet(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
                    selectedPetId === pet.id ? 'border-brass bg-brass/5' : 'border-paper-dark'
                  }`}
                >
                  {pet.photo_url ? (
                    <img src={pet.photo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <DefaultAvatar name={pet.name} className="h-12 w-12 rounded-xl text-lg" />
                  )}
                  <div>
                    <p className="font-medium">{pet.name}</p>
                    <p className="text-xs text-ink-muted">
                      {pet.breed || 'Pet'} · {petSizeLabel(pet.size)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {!creatingPet ? (
              <button
                type="button"
                onClick={() => setCreatingPet(true)}
                className="mb-4 text-sm text-brass hover:underline"
              >
                + Cadastrar novo pet
              </button>
            ) : (
              <div className="mb-4 space-y-3 rounded-lg border border-dashed border-paper-dark p-4">
                <input
                  value={newPetName}
                  onChange={(e) => setNewPetName(e.target.value)}
                  placeholder="Nome do pet"
                  className="w-full rounded-lg border border-paper-dark px-3 py-2 focus:border-brass focus:outline-none"
                />
                <input
                  value={newPetBreed}
                  onChange={(e) => setNewPetBreed(e.target.value)}
                  placeholder="Raça (opcional)"
                  className="w-full rounded-lg border border-paper-dark px-3 py-2 focus:border-brass focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  {PET_SIZES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setNewPetSize(s.value)}
                      className={`rounded-lg px-3 py-1.5 text-sm ${
                        newPetSize === s.value ? 'bg-brass text-white' : 'bg-paper'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={createPet}
                  className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-white"
                >
                  Salvar pet
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-lg border py-3">
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedPetId}
                className="flex-1 rounded-lg bg-brass py-3 font-semibold text-white disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-display text-2xl mb-2">Serviços</h2>
            <p className="text-sm text-ink-muted mb-4">
              Para {selectedPet?.name} · porte {selectedPet && petSizeLabel(selectedPet.size)}
            </p>
            <div className="space-y-3">
              {services.map((s) => {
                const dur = selectedPet
                  ? getPetServicesDuration([s], selectedPet.size, rules)
                  : s.duration_minutes
                const price = selectedPet
                  ? getPetServicesPrice([s], selectedPet.size, rules)
                  : Number(s.price)
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 ${
                      selectedServiceIds.has(s.id) ? 'border-brass bg-brass/5' : 'border-paper-dark'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedServiceIds.has(s.id)}
                        onChange={() => toggleService(s.id)}
                        className="accent-brass"
                      />
                      <span className="font-medium">{s.name}</span>
                    </div>
                    <div className="text-right font-mono text-sm">
                      <div className="text-brass">{formatPrice(price)}</div>
                      <div className="text-ink-muted">{formatDuration(dur)}</div>
                    </div>
                  </label>
                )
              })}
            </div>
            {selectedServices.length > 0 && (
              <div className="mt-4 flex justify-between rounded-lg bg-paper p-4 font-mono text-sm">
                <span>Total · {formatDuration(duration)}</span>
                <span className="text-brass font-semibold">{formatPrice(totalPrice)}</span>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 rounded-lg border py-3">
                Voltar
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={selectedServices.length === 0}
                className="flex-1 rounded-lg bg-brass py-3 font-semibold text-white disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="font-display text-2xl mb-2">Horário</h2>
            <p className="text-sm text-ink-muted mb-4">
              Duração calculada: {formatDuration(duration)}
            </p>

            {barbers.length > 1 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Profissional</p>
                <div className="flex flex-wrap gap-2">
                  {barbers.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBarberId(b.id)
                        setSelectedDay(null)
                        setSelectedDate(null)
                        setSelectedTime(null)
                      }}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        selectedBarberId === b.id ? 'bg-brass text-white' : 'bg-paper'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedBarberId && (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {activeDays.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setSelectedDay(d)
                        setSelectedDate(null)
                        setSelectedTime(null)
                      }}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        selectedDay === d ? 'bg-brass text-white' : 'bg-paper'
                      }`}
                    >
                      {DAY_NAMES[d].slice(0, 3)}
                    </button>
                  ))}
                </div>

                {selectedDay !== null && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {availableDates.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedDate(d)
                          setSelectedTime(null)
                        }}
                        className={`rounded-lg px-3 py-2 font-mono text-sm ${
                          selectedDate === d ? 'bg-brass text-white' : 'bg-paper'
                        }`}
                      >
                        {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </button>
                    ))}
                  </div>
                )}

                {selectedDate && (
                  <div>
                    {availableSlots.length === 0 ? (
                      <p className="text-sm text-ink-muted">
                        Nenhum horário com tempo suficiente nesta data.
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {availableSlots.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedTime(t)}
                            className={`rounded-lg py-2 font-mono text-sm ${
                              selectedTime === t ? 'bg-brass text-white' : 'bg-paper'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 rounded-lg border py-3">
                Voltar
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={!selectedDate || !selectedTime || !selectedBarberId}
                className="flex-1 rounded-lg bg-brass py-3 font-semibold text-white disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="font-display text-2xl mb-4">Confirmar</h2>
            <div className="rounded-lg bg-paper p-4 text-sm space-y-2 mb-4">
              <p>
                <strong>{selectedPet?.name}</strong> ·{' '}
                {selectedPet && petSizeLabel(selectedPet.size)}
              </p>
              <p className="text-ink-muted">
                {selectedServices.map((s) => s.name).join(', ')}
              </p>
              <p>
                {selectedBarber?.name} ·{' '}
                {selectedDate &&
                  new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}{' '}
                às <span className="font-mono">{selectedTime}</span>
              </p>
              <p className="text-ink-muted">{formatDuration(duration)}</p>
              <p className="font-mono text-brass text-lg">{formatPrice(totalPrice)}</p>
              <p className="text-ink-muted">
                {customerName || customer?.name} · {phone}
              </p>
            </div>
            {noShowPolicy?.enabled && (
              <label className="mb-4 flex items-start gap-3 rounded-lg border border-paper-dark p-3 text-sm">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 accent-brass"
                />
                <span className="text-ink-muted">
                  {noShowPolicy.terms_text ||
                    `Cancelamentos com menos de ${noShowPolicy.hours_before}h podem estar sujeitos à cobrança de ${formatPrice(Number(noShowPolicy.fee_amount))} conforme política do estabelecimento. A cobrança efetiva depende de gateway e regras aplicáveis — este aceite apenas registra seu consentimento.`}
                  <span className="block mt-1 text-xs">
                    Versão {noShowPolicy.terms_version}
                  </span>
                </span>
              </label>
            )}
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(4)} className="flex-1 rounded-lg border py-3">
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
    </SegmentProvider>
  )
}
