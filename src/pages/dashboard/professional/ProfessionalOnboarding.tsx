import { useEffect, useState, type FormEvent } from 'react'
import { FieldHint, FieldLabel } from '../../../components/FormHints'
import {
  parseOnboardingServices,
  parseOnboardingStaff,
  type OnboardingServiceInput,
  type OnboardingStaffInput,
} from '../../../lib/onboarding'
import { supabase } from '../../../lib/supabase'
import type { Shop, ShopSegment } from '../../../lib/types'

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
  const businessLabel = isPet ? 'pet shop' : 'barbearia'
  const professionalPlaceholder = isPet ? 'Ex: Maria' : 'Ex: João'
  const rolePlaceholder = isPet ? 'Ex: Tosadora ou Banhista' : 'Ex: Barbeiro ou Cabeleireiro'

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

  const goToTeam = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const parsed = parseOnboardingServices(services)
      if (existingServices.length + parsed.length === 0) {
        throw new Error('Cadastre pelo menos um serviço para continuar.')
      }
      setStep(1)
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
      setStep(2)
    } catch (err) {
      setError(getErrorMessage(err, 'Revise os dados da equipe.'))
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
      const parsedServices = parseOnboardingServices(services)
      const parsedStaff = parseOnboardingStaff(staff)
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
            Vamos deixar sua {businessLabel} pronta?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-charcoal-muted sm:text-base">
            Responda o básico agora e entre no painel com serviços, equipe e agenda organizados.
          </p>
        </div>

        <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Progresso da configuração">
          {['Serviços', 'Equipe', 'Horários'].map((label, index) => (
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

        <section className="rounded-2xl border border-charcoal-light bg-charcoal-light/30 p-5 shadow-2xl sm:p-8">
          {step === 0 && (
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

              <OnboardingActions error={error} nextLabel="Continuar para equipe" />
            </form>
          )}

          {step === 1 && (
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
                  setStep(0)
                }}
              />
            </form>
          )}

          {step === 2 && (
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
                Ao concluir, sua {businessLabel} já terá o essencial para receber agendamentos.
              </div>

              <OnboardingActions
                error={error}
                nextLabel={saving ? 'Configurando...' : 'Concluir e abrir o painel'}
                disabled={saving}
                onBack={() => {
                  setError('')
                  setStep(1)
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
}

function OnboardingActions({ error, nextLabel, disabled = false, onBack }: ActionProps) {
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
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-brass px-6 py-3 font-semibold text-charcoal disabled:cursor-wait disabled:opacity-60"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
