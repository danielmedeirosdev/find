import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  bookingErrorMessage,
  getActiveDays,
  getScheduleForDay,
  getAvailableSlots,
  getNextDatesForDay,
  loadOccupiedSlots,
} from '../../lib/booking'
import { getPetServicesDuration, getPetServicesPrice, petSizeLabel } from '../../lib/pet'
import {
  createPetForCustomer,
  createPublicBooking,
  finalizePublicBooking,
  lookupPetCustomer as lookupPetCustomerSecure,
  rememberBookingPhone,
  upsertPetCustomer,
} from '../../lib/secureBooking'
import { formatDuration, formatPhone, formatPrice } from '../../lib/format'
import { DefaultAvatar } from '../../components/MediaUI'
import { BrandAccent } from '../../components/BrandAccent'
import { SegmentProvider } from '../../contexts/SegmentContext'
import { useAuth } from '../../contexts/AuthContext'
import { DAY_NAMES, PET_SIZES } from '../../lib/types'
import type {
  Barber,
  BarberSchedule,
  BookingConfirmationState,
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
  const { user, clientProfile } = useAuth()

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
  const [selectedPetIds, setSelectedPetIds] = useState<Set<string>>(new Set())
  const [creatingPet, setCreatingPet] = useState(false)
  const [newPetName, setNewPetName] = useState('')
  const [newPetSize, setNewPetSize] = useState<PetSize>('medio')
  const [newPetBreed, setNewPetBreed] = useState('')
  const [notes, setNotes] = useState('')

  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set())
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [lookupDone, setLookupDone] = useState(false)

  useEffect(() => {
    if (clientProfile?.phone && !phone) {
      setPhone(formatPhone(clientProfile.phone))
    }
    if (clientProfile?.name && !customerName) {
      setCustomerName(clientProfile.name)
    }
  }, [clientProfile])

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

      const slots = await loadOccupiedSlots(shopId!)

      setShop(shopData)
      setServices(serviceList)
      setRules(sizeRules)
      setBarbers(barb || [])
      setSchedules(sched)
      setOccupiedSlots(slots)
      if ((barb || []).length === 1) setSelectedBarberId(barb![0].id)
      setLoading(false)
    }
    load()
  }, [shopId])

  // Atualiza horários ocupados ao chegar na etapa de agenda
  useEffect(() => {
    if (!shopId || step !== 4) return
    loadOccupiedSlots(shopId).then(setOccupiedSlots)
  }, [shopId, step])

  const selectedPets = useMemo(
    () => pets.filter((p) => selectedPetIds.has(p.id)),
    [pets, selectedPetIds]
  )
  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.has(s.id)),
    [services, selectedServiceIds]
  )

  // Soma duração/preço de cada pet (mesmos serviços aplicados a cada um)
  const duration = selectedPets.reduce(
    (sum, pet) => sum + getPetServicesDuration(selectedServices, pet.size, rules),
    0
  )
  const totalPrice = selectedPets.reduce(
    (sum, pet) => sum + getPetServicesPrice(selectedServices, pet.size, rules),
    0
  )

  const togglePet = (id: string) => {
    setSelectedPetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      if (next.size >= 2) {
        setError('No máximo 2 pets no mesmo horário (mesma pessoa).')
        return prev
      }
      setError('')
      next.add(id)
      return next
    })
    setCreatingPet(false)
  }

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
    try {
      const result = await lookupPetCustomerSecure(shopId, digits)
      if (result.customer) {
        setCustomer(result.customer)
        setCustomerName(result.customer.name)
        setPets(result.pets)
      } else {
        setCustomer(null)
        setPets([])
      }
      setLookupDone(true)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível localizar o cadastro.')
    }
  }

  const ensureCustomer = async (): Promise<ShopCustomer | null> => {
    if (!shopId) return null
    const digits = phone.replace(/\D/g, '')
    if (customer) return customer
    if (!customerName.trim()) {
      setError('Informe seu nome.')
      return null
    }
    try {
      const data = await upsertPetCustomer(shopId, digits, customerName)
      setCustomer(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cliente.')
      return null
    }
  }

  const createPet = async () => {
    const cust = await ensureCustomer()
    if (!cust || !shopId || !newPetName.trim()) return
    let data: Pet
    try {
      data = await createPetForCustomer({
        shopId,
        phone,
        name: newPetName,
        size: newPetSize,
        breed: newPetBreed,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar pet.')
      return
    }
    setPets((prev) => [...prev, data])
    setSelectedPetIds((prev) => {
      const next = new Set(prev)
      if (next.size < 2) next.add(data.id)
      return next
    })
    setCreatingPet(false)
    setNewPetName('')
    setNewPetBreed('')
    setError('')
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
    if (!shop || !selectedBarberId || !selectedDate || !selectedTime || selectedPets.length === 0) {
      return
    }
    if (selectedPets.length > 2) {
      setError('No máximo 2 pets no mesmo horário (mesma pessoa).')
      return
    }
    const cust = await ensureCustomer()
    if (!cust) return

    setSubmitting(true)
    setError('')

    // Vincula à conta FIND (Minhas Reservas / avaliações) quando o cliente está logado
    if (user) {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      if (!existingClient) {
        const { error: clientError } = await supabase.from('clients').insert({
          id: user.id,
          name: cust.name || 'Cliente',
          phone: cust.phone || null,
        })
        if (clientError) {
          setError(clientError.message)
          setSubmitting(false)
          return
        }
      } else if (cust.phone) {
        await supabase
          .from('clients')
          .update({ phone: cust.phone })
          .eq('id', user.id)
          .is('phone', null)
      }
    }

    const primaryPet = selectedPets[0]
    const notesValue = notes.trim() || null

    let bookingId: string
    try {
      bookingId = await createPublicBooking({
        shopId: shop.id,
        barberId: selectedBarberId,
        clientName: cust.name,
        clientPhone: cust.phone,
        date: selectedDate,
        time: selectedTime,
        petId: primaryPet.id,
        shopCustomerId: cust.id,
        durationMinutes: duration,
        notes: notesValue,
      })
      await finalizePublicBooking({
        bookingId,
        phone: cust.phone,
        serviceIds: selectedServices.map((service) => service.id),
        petIds: selectedPets.map((pet) => pet.id),
      })
    } catch (err) {
      const msg = bookingErrorMessage(err)
      setError(msg)
      setSubmitting(false)
      if (/horário|reservado/i.test(msg) && shopId) {
        setSelectedTime(null)
        setStep(4)
        const slots = await loadOccupiedSlots(shopId)
        setOccupiedSlots(slots)
      }
      return
    }

    const petNames = selectedPets.map((p) => p.name).join(' · ')

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
        price: selectedPets.reduce(
          (sum, pet) => sum + getPetServicesPrice([s], pet.size, rules),
          0
        ),
        duration_minutes: selectedPets.reduce(
          (sum, pet) => sum + getPetServicesDuration([s], pet.size, rules),
          0
        ),
      })),
      petName: petNames,
      petSize: selectedPets.map((p) => petSizeLabel(p.size)).join(' · '),
      durationMinutes: duration,
      notes: notesValue || undefined,
    }

    rememberBookingPhone(bookingId, cust.phone)
    navigate(`/confirmacao/${bookingId}`, { state: confirmationState })
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
            <p className="text-sm text-ink-muted mb-4">
              Pode escolher até 2 pets no mesmo horário (só da mesma pessoa).
            </p>
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
              {pets.map((pet) => {
                const selected = selectedPetIds.has(pet.id)
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => togglePet(pet.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
                      selected ? 'border-brass bg-brass/5' : 'border-paper-dark'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                        selected
                          ? 'border-brass bg-brass text-white'
                          : 'border-paper-dark text-transparent'
                      }`}
                    >
                      {selected ? (
                        <span className="block h-2 w-2 rounded-sm bg-white" />
                      ) : null}
                    </span>
                    {pet.photo_url ? (
                      <img
                        src={pet.photo_url}
                        alt=""
                        className="h-12 w-12 rounded-xl object-cover"
                      />
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
                )
              })}
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
                disabled={selectedPetIds.size === 0}
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
              Para {selectedPets.map((p) => p.name).join(' · ') || '…'}
              {selectedPets.length > 1
                ? ' · valores somados para cada pet'
                : selectedPets[0]
                  ? ` · porte ${petSizeLabel(selectedPets[0].size)}`
                  : ''}
            </p>
            <div className="space-y-3">
              {services.map((s) => {
                const dur = selectedPets.reduce(
                  (sum, pet) => sum + getPetServicesDuration([s], pet.size, rules),
                  0
                )
                const price = selectedPets.reduce(
                  (sum, pet) => sum + getPetServicesPrice([s], pet.size, rules),
                  0
                )
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
                <strong>{selectedPets.map((p) => p.name).join(' · ')}</strong>
                {selectedPets.length > 0 && (
                  <span className="text-ink-muted">
                    {' '}
                    · {selectedPets.map((p) => petSizeLabel(p.size)).join(' · ')}
                  </span>
                )}
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

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Observação <span className="text-ink-muted font-normal">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Ex: táxi dog, trazer na coleira, alergia a perfume…"
                className="w-full rounded-lg border border-paper-dark px-4 py-3 text-sm focus:border-brass focus:outline-none"
              />
            </div>

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
