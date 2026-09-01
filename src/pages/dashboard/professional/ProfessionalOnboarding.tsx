import { useEffect, useState, type FormEvent } from 'react'
import { FieldHint, FieldLabel } from '../../../components/FormHints'
import {
  PET_BUSINESS_TYPES,
  parseOnboardingProfile,
  parseOnboardingServices,
  parseOnboardingStaff,
  parsePetOnboardingChoice,
  type OnboardingServiceInput,
  type OnboardingStaffInput,
} from '../../../lib/onboarding'
import { supabase } from '../../../lib/supabase'
import type {
  PetBusinessType,
  PetOnboardingMode,
  Shop,
  ShopSegment,
} from '../../../lib/types'

const WEEK_DAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

const EMPTY_SERVICE: OnboardingServiceInput = { name: '', price: '', duration: '30' }
const EMPTY_STAFF: OnboardingStaffInput = { name: '', role: '' }
const CORE_ONBOARDING_STEPS = ['Informações', 'Serviços', 'Equipe', 'Horários']
const GUIDED_STEP_DETAILS: Record<number, { title: string; description: string }> = {
  2: {
    title: 'Prepare as informações que o cliente verá',
    description: 'Informe uma frase curta, o endereço completo e o WhatsApp usado pelo negócio.',
  },
  3: {
    title: 'Cadastre o que pode ser agendado',
    description: 'Para cada serviço, informe nome, preço e duração. Tudo poderá ser editado depois.',
  },
  4: {
    title: 'Monte a equipe de atendimento',
    description: 'Inclua também o proprietário caso ele atenda. Cada pessoa terá uma agenda própria.',
  },
  5: {
    title: 'Defina o horário inicial da agenda',
    description: 'Escolha dias, início e fim do expediente. Horários individuais podem ser ajustados no painel.',
  },
}

interface Props {
  shop: Shop
  segment: ShopSegment
  onComplete: () => Promise<void> | void
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message
  }

  return fallback
}

export function ProfessionalOnboarding({ shop, segment, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [petBusinessType, setPetBusinessType] = useState<PetBusinessType | ''>(
    shop.pet_business_type || ''
  )
  const [petOnboardingMode, setPetOnboardingMode] = useState<PetOnboardingMode | ''>(
    shop.pet_onboarding_mode || ''
  )
  const [slogan, setSlogan] = useState(shop.slogan || '')
  const [address, setAddress] = useState(shop.address || '')
  const [phone, setPhone] = useState(shop.phone || '')
  const [services, setServices] = useState<OnboardingServiceInput[]>([{ ...EMPTY_SERVICE }])
  const [staff, setStaff] = useState<OnboardingStaffInput[]>([{ ...EMPTY_STAFF }])
  const [existingServices, setExistingServices] = useState<string[]>([])
  const [existingStaff, setExistingStaff] = useState<string[]>([])
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5, 6])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isPet = segment === 'pet'
  const businessWithArticle = isPet ? 'seu pet shop' : 'sua barbearia'
  const businessReady = isPet ? 'pronto' : 'pronta'
  const professionalPlaceholder = isPet ? 'Ex: Maria' : 'Ex: João'
  const rolePlaceholder = isPet ? 'Ex: Tosadora ou Banhista' : 'Ex: Barbeiro ou Cabeleireiro'
  const onboardingSteps = isPet
    ? ['Ramo', 'Como começar', ...CORE_ONBOARDING_STEPS]
    : CORE_ONBOARDING_STEPS
  const profileStep = isPet ? 2 : 0
  const servicesStep = profileStep + 1
  const teamStep = profileStep + 2
  const scheduleStep = profileStep + 3

  useEffect(() => {
    let active = true
    const loadExisting = async () => {
      const [servicesResult, staffResult] = await Promise.all([
        supabase.from('services').select('name').eq('shop_id', shop.id).order('name'),
        supabase.from('barbers').select('name').eq('shop_id', shop.id).order('name'),
      ])
      if (!active) return
      setExistingServices((servicesResult.data ?? []).map((item) => item.name))
      const staffNames = (staffResult.data ?? []).map((item) => item.name)
      setExistingStaff(staffNames)
      if (staffNames.length > 0) setStaff([])
      setLoading(false)
    }
    loadExisting()
    return () => {
      active = false
    }
  }, [shop.id])

  const updateService = (
    index: number,
    field: keyof OnboardingServiceInput,
    value: string
  ) => {
    setServices((current) =>
      current.map((service, rowIndex) =>
        rowIndex === index ? { ...service, [field]: value } : service
      )
    )
  }

  const updateStaff = (index: number, field: keyof OnboardingStaffInput, value: string) => {
    setStaff((current) =>
      current.map((person, rowIndex) =>
        rowIndex === index ? { ...person, [field]: value } : person
      )
    )
  }

  const setStaffCount = (count: number) => {
    const safeCount = Math.min(20, Math.max(0, count))
    setStaff((current) =>
      Array.from({ length: safeCount }, (_, index) => current[index] ?? { ...EMPTY_STAFF })
    )
  }

  const goToServices = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      parseOnboardingProfile({ slogan, address, phone })
      setStep(servicesStep)
    } catch (err) {
      setError(getErrorMessage(err, 'Revise as informações do estabelecimento.'))
    }
  }

  const goToTeam = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const parsed = parseOnboardingServices(services)
      if (existingServices.length + parsed.length === 0) {
        throw new Error('Cadastre pelo menos um serviço para continuar.')
      }
      setStep(teamStep)
    } catch (err) {
      setError(getErrorMessage(err, 'Revise os serviços informados.'))
    }
  }

  const goToSchedule = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const parsed = parseOnboardingStaff(staff)
      if (existingStaff.length + parsed.length === 0) {
        throw new Error('Informe pelo menos uma pessoa que realiza atendimentos.')
      }
      setStep(scheduleStep)
    } catch (err) {
      setError(getErrorMessage(err, 'Revise os dados da equipe.'))
    }
  }

  const savePetStart = async () => {
    setError('')
    setSaving(true)
    try {
      const choice = parsePetOnboardingChoice(petBusinessType, petOnboardingMode)
      const { data, error: updateError } = await supabase
        .from('shops')
        .update(choice)
        .eq('id', shop.id)
        .eq('segment', 'pet')
        .select('id')
        .maybeSingle()
      if (updateError) throw updateError
      if (!data) throw new Error('Não foi possível salvar as preferências do negócio.')
      setStep(profileStep)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar esta etapa.'))
    } finally {
      setSaving(false)
    }
  }

  const finish = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (workDays.length === 0) {
      setError('Selecione pelo menos um dia de atendimento.')
      return
    }
    if (!startTime || !endTime || endTime <= startTime) {
      setError('O horário final deve ser posterior ao inicial.')
      return
    }

    setSaving(true)
    try {
      const parsedProfile = parseOnboardingProfile({ slogan, address, phone })
      const parsedServices = parseOnboardingServices(services)
      const parsedStaff = parseOnboardingStaff(staff)
      const { data: updatedShop, error: profileError } = await supabase
        .from('shops')
        .update(parsedProfile)
        .eq('id', shop.id)
        .select('id')
        .maybeSingle()
      if (profileError) throw profileError
      if (!updatedShop) {
        throw new Error('Não foi possível salvar as informações do estabelecimento.')
      }

      const { error: rpcError } = await supabase.rpc('complete_professional_onboarding', {
        p_shop_id: shop.id,
        p_services: parsedServices,
        p_staff: parsedStaff,
        p_work_days: workDays,
        p_start_time: startTime,
        p_end_time: endTime,
      })
      if (rpcError) throw rpcError
      await onComplete()
    } catch (err) {
      setError(
        getErrorMessage(err, 'Não foi possível concluir a configuração. Tente novamente.')
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-charcoal-muted">
        Preparando sua configuração inicial...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-charcoal px-4 py-8 text-white sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-brass">ONEFIND</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">
            Vamos deixar {businessWithArticle} {businessReady}?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-charcoal-muted sm:text-base">
            Responda o básico agora e entre no painel com serviços, equipe e agenda organizados.
          </p>
        </div>

        <ol
          className={`mb-6 grid gap-2 ${isPet ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4'}`}
          aria-label="Progresso da configuração"
        >
          {onboardingSteps.map((label, index) => (
            <li
              key={label}
              className={`rounded-lg border px-2 py-3 text-center text-xs sm:text-sm ${
                index <= step
                  ? 'border-brass bg-brass/10 text-brass'
                  : 'border-charcoal-light text-charcoal-muted'
              }`}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="mr-1 font-mono">{index + 1}.</span> {label}
            </li>
          ))}
        </ol>

        <section className="rounded-2xl border border-charcoal-light bg-charcoal-light/30 p-5 shadow-xl sm:p-8">
          {isPet && petOnboardingMode === 'guided' && step >= profileStep ? (
            <aside
              className="mb-6 rounded-xl border border-brass/40 bg-charcoal p-4"
              aria-label="Orientação desta etapa"
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">
                Configuração guiada · Passo {step + 1} de {onboardingSteps.length}
              </p>
              <p className="mt-2 font-medium text-white">{GUIDED_STEP_DETAILS[step]?.title}</p>
              <p className="mt-1 text-sm text-charcoal-muted">
                {GUIDED_STEP_DETAILS[step]?.description}
              </p>
            </aside>
          ) : null}
          {isPet && step === 0 && (
            <div>
              <h2 className="font-display text-2xl text-brass">Qual é o ramo do seu negócio?</h2>
              <p className="mt-2 text-sm text-charcoal-muted">
                Isso organiza sua configuração inicial. O painel continua único para todos os
                negócios PET.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {PET_BUSINESS_TYPES.map((option) => {
                  const selected = petBusinessType === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setPetBusinessType(option.value)
                        setError('')
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        selected
                          ? 'border-brass bg-brass/10'
                          : 'border-charcoal-light hover:border-brass/50'
                      }`}
                    >
                      <span className="block font-medium text-white">{option.label}</span>
                      <span className="mt-1 block text-sm text-charcoal-muted">
                        {option.description}
                      </span>
                    </button>
                  )
                })}
              </div>
              <OnboardingActions
                error={error}
                nextLabel="Continuar"
                disabled={!petBusinessType}
                onNext={() => setStep(1)}
              />
            </div>
          )}

          {isPet && step === 1 && (
            <div>
              <h2 className="font-display text-2xl text-brass">Como você quer começar?</h2>
              <p className="mt-2 text-sm text-charcoal-muted">
                Escolha o caminho mais confortável. Você poderá ajustar tudo depois.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {([
                  {
                    value: 'self_service',
                    title: 'Configuração rápida',
                    description: 'Preencha diretamente os dados essenciais e abra o painel.',
                  },
                  {
                    value: 'guided',
                    title: 'Configuração guiada',
                    description: 'Veja o que preencher em cada etapa, com explicações e exemplos.',
                    recommended: true,
                  },
                ] as const).map((option) => {
                  const selected = petOnboardingMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setPetOnboardingMode(option.value)
                        setError('')
                      }}
                      className={`relative rounded-xl border p-5 text-left transition-colors ${
                        selected
                          ? 'border-brass bg-brass/10'
                          : 'border-charcoal-light hover:border-brass/50'
                      }`}
                    >
                      {'recommended' in option && option.recommended ? (
                        <span className="mb-3 inline-block rounded-full bg-brass/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-brass">
                          Recomendado
                        </span>
                      ) : null}
                      <span className="block font-medium text-white">{option.title}</span>
                      <span className="mt-1 block text-sm text-charcoal-muted">
                        {option.description}
                      </span>
                    </button>
                  )
                })}
              </div>
              {petOnboardingMode === 'guided' ? (
                <div className="mt-4 rounded-xl border border-brass/40 bg-brass/10 p-4">
                  <p className="font-medium text-white">Você fará seis passos simples:</p>
                  <ol className="mt-3 grid gap-2 text-sm text-charcoal-muted sm:grid-cols-2">
                    <li><span className="text-brass">1.</span> Escolher o ramo PET</li>
                    <li><span className="text-brass">2.</span> Escolher como configurar</li>
                    <li><span className="text-brass">3.</span> Informar os dados públicos</li>
                    <li><span className="text-brass">4.</span> Cadastrar os serviços</li>
                    <li><span className="text-brass">5.</span> Montar a equipe</li>
                    <li><span className="text-brass">6.</span> Definir os horários</li>
                  </ol>
                  <p className="mt-3 text-xs text-charcoal-muted">
                    O próprio ONEFIND orienta o preenchimento. Não há atendimento humano ou configuração feita por terceiros.
                  </p>
                </div>
              ) : null}
              <OnboardingActions
                error={error}
                nextLabel="Salvar e continuar"
                disabled={!petOnboardingMode || saving}
                onBack={() => setStep(0)}
                onNext={savePetStart}
              />
            </div>
          )}

          {step === profileStep && (
            <form onSubmit={goToServices}>
              <h2 className="font-display text-2xl text-brass">Conte o básico sobre seu negócio</h2>
              <p className="mt-2 text-sm text-charcoal-muted">
                Estas informações deixam sua página pública pronta para os primeiros clientes.
              </p>

              <div className="mt-6 space-y-5">
                <label className="block">
                  <FieldLabel>Slogan</FieldLabel>
                  <input
                    value={slogan}
                    onChange={(event) => setSlogan(event.target.value)}
                    required
                    maxLength={120}
                    placeholder={
                      isPet
                        ? 'Ex: Cuidado profissional para quem você ama.'
                        : 'Ex: Estilo, precisão e tradição.'
                    }
                    className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 text-white focus:border-brass focus:outline-none"
                  />
                  <FieldHint>Frase curta que aparece sob o nome na página pública.</FieldHint>
                </label>

                <label className="block">
                  <FieldLabel>Endereço</FieldLabel>
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    required
                    maxLength={200}
                    autoComplete="street-address"
                    placeholder="Ex: Rua das Palmeiras, 482 - Centro"
                    className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 text-white focus:border-brass focus:outline-none"
                  />
                </label>

                <label className="block">
                  <FieldLabel>{isPet ? 'Telefone / WhatsApp' : 'Telefone'}</FieldLabel>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    maxLength={20}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 text-white focus:border-brass focus:outline-none"
                  />
                  <FieldHint>Utilizado para contato dos clientes.</FieldHint>
                </label>
              </div>

              <OnboardingActions error={error} nextLabel="Continuar para serviços" />
            </form>
          )}

          {step === servicesStep && (
            <form onSubmit={goToTeam}>
              <h2 className="font-display text-2xl text-brass">Quais serviços você presta?</h2>
              <p className="mt-2 text-sm text-charcoal-muted">
                Adicione os serviços que seus clientes poderão agendar. Nada vem preenchido por
                padrão em novas contas.
              </p>

              {existingServices.length > 0 && (
                <div className="mt-5 rounded-xl border border-charcoal-light bg-charcoal p-4">
                  <p className="text-xs uppercase tracking-wide text-charcoal-muted">
                    Já cadastrados nesta conta
                  </p>
                  <p className="mt-2 text-sm text-white">{existingServices.join(' · ')}</p>
                  <FieldHint>Esses registros serão preservados e poderão ser editados no painel.</FieldHint>
                </div>
              )}

              <div className="mt-6 space-y-4">
                {services.map((service, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-charcoal-light p-4 sm:grid-cols-[1.5fr_1fr_1fr_auto]"
                  >
                    <label>
                      <FieldLabel>Serviço</FieldLabel>
                      <input
                        value={service.name}
                        onChange={(event) => updateService(index, 'name', event.target.value)}
                        placeholder={isPet ? 'Ex: Banho e tosa' : 'Ex: Corte masculino'}
                        className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 text-white focus:border-brass focus:outline-none"
                      />
                    </label>
                    <label>
                      <FieldLabel>Preço</FieldLabel>
                      <input
                        value={service.price}
                        onChange={(event) => updateService(index, 'price', event.target.value)}
                        inputMode="decimal"
                        placeholder="Ex: 45,00"
                        className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 font-mono text-white focus:border-brass focus:outline-none"
                      />
                    </label>
                    <label>
                      <FieldLabel>Duração</FieldLabel>
                      <input
                        type="number"
                        min="5"
                        max="1440"
                        step="5"
                        value={service.duration}
                        onChange={(event) => updateService(index, 'duration', event.target.value)}
                        className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 font-mono text-white focus:border-brass focus:outline-none"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() =>
                          setServices((current) => current.filter((_, rowIndex) => rowIndex !== index))
                        }
                        disabled={services.length === 1}
                        className="rounded-lg px-3 py-2.5 text-sm text-red-400 disabled:invisible"
                        aria-label={`Remover serviço ${index + 1}`}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setServices((current) => [...current, { ...EMPTY_SERVICE }])}
                className="mt-4 rounded-lg border border-brass px-4 py-2 text-sm text-brass"
              >
                + Adicionar outro serviço
              </button>

              <OnboardingActions
                error={error}
                nextLabel="Continuar para equipe"
                onBack={() => {
                  setError('')
                  setStep(profileStep)
                }}
              />
            </form>
          )}

          {step === teamStep && (
            <form onSubmit={goToSchedule}>
              <h2 className="font-display text-2xl text-brass">Quem realiza os atendimentos?</h2>
              <p className="mt-2 text-sm text-charcoal-muted">
                Inclua você também, caso atenda clientes. Cada pessoa terá sua própria agenda.
              </p>

              {existingStaff.length > 0 && (
                <div className="mt-5 rounded-xl border border-charcoal-light bg-charcoal p-4 text-sm">
                  <span className="text-charcoal-muted">Já cadastrados: </span>
                  {existingStaff.join(' · ')}
                </div>
              )}

              <label className="mt-6 block max-w-xs">
                <FieldLabel>Quantas novas pessoas você quer adicionar?</FieldLabel>
                <input
                  type="number"
                  min={existingStaff.length > 0 ? 0 : 1}
                  max="20"
                  value={staff.length}
                  onChange={(event) => setStaffCount(Number(event.target.value))}
                  className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 font-mono text-white focus:border-brass focus:outline-none"
                />
              </label>

              <div className="mt-5 space-y-3">
                {staff.map((person, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-charcoal-light p-4 sm:grid-cols-2"
                  >
                    <label>
                      <FieldLabel>Nome da pessoa {index + 1}</FieldLabel>
                      <input
                        value={person.name}
                        onChange={(event) => updateStaff(index, 'name', event.target.value)}
                        placeholder={professionalPlaceholder}
                        className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 text-white focus:border-brass focus:outline-none"
                      />
                    </label>
                    <label>
                      <FieldLabel>Cargo</FieldLabel>
                      <input
                        value={person.role}
                        onChange={(event) => updateStaff(index, 'role', event.target.value)}
                        placeholder={rolePlaceholder}
                        className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 text-white focus:border-brass focus:outline-none"
                      />
                    </label>
                  </div>
                ))}
              </div>

              <OnboardingActions
                error={error}
                nextLabel="Continuar para horários"
                onBack={() => {
                  setError('')
                  setStep(servicesStep)
                }}
              />
            </form>
          )}

          {step === scheduleStep && (
            <form onSubmit={finish}>
              <h2 className="font-display text-2xl text-brass">Quando vocês atendem?</h2>
              <p className="mt-2 text-sm text-charcoal-muted">
                Este horário será aplicado às pessoas adicionadas agora e poderá ser ajustado
                individualmente depois.
              </p>

              <fieldset className="mt-6">
                <legend className="text-sm font-medium text-white">Dias de atendimento</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {WEEK_DAYS.map((day) => {
                    const selected = workDays.includes(day.value)
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setWorkDays((current) =>
                            selected
                              ? current.filter((value) => value !== day.value)
                              : [...current, day.value]
                          )
                        }
                        className={`rounded-lg border px-4 py-2 text-sm ${
                          selected
                            ? 'border-brass bg-brass text-charcoal'
                            : 'border-charcoal-light text-charcoal-muted'
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label>
                  <FieldLabel>Início</FieldLabel>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 font-mono text-white focus:border-brass focus:outline-none"
                  />
                </label>
                <label>
                  <FieldLabel>Fim</FieldLabel>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 font-mono text-white focus:border-brass focus:outline-none"
                  />
                </label>
              </div>

              <div className="mt-7 rounded-xl border border-brass/40 bg-brass/10 p-4 text-sm">
                Ao concluir, {businessWithArticle} já terá o essencial para receber agendamentos.
              </div>

              <OnboardingActions
                error={error}
                nextLabel={saving ? 'Configurando...' : 'Concluir e abrir o painel'}
                disabled={saving}
                onBack={() => {
                  setError('')
                  setStep(teamStep)
                }}
              />
            </form>
          )}
        </section>
      </div>
    </main>
  )
}

interface ActionProps {
  error: string
  nextLabel: string
  disabled?: boolean
  onBack?: () => void
  onNext?: () => void
}

function OnboardingActions({ error, nextLabel, disabled = false, onBack, onNext }: ActionProps) {
  return (
    <div className="mt-8">
      {error && (
        <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={disabled}
            className="rounded-lg border border-charcoal-light px-5 py-3 text-sm text-charcoal-muted disabled:opacity-60"
          >
            Voltar
          </button>
        ) : (
          <span />
        )}
        <button
          type={onNext ? 'button' : 'submit'}
          onClick={onNext}
          disabled={disabled}
          className="rounded-lg bg-brass px-6 py-3 font-semibold text-charcoal disabled:cursor-wait disabled:opacity-60"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
