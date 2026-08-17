import { useState } from 'react'
import { DAY_NAMES } from '../lib/types'
import type { BarberSchedule } from '../lib/types'

interface Props {
  barberId: string
  schedules: BarberSchedule[]
  onUpdate: (
    barberId: string,
    day: number,
    field: 'is_active' | 'start_time' | 'end_time',
    value: boolean | string
  ) => Promise<void>
  onApplyHours: (
    barberId: string,
    days: number[],
    startTime: string,
    endTime: string
  ) => Promise<void>
}

type ApplyPrompt = {
  sourceDay: number
  start: string
  end: string
  targetDays: number[]
}

/**
 * Grade semanal de horários do profissional (compartilhada entre FIND Barbearia e FIND Pet).
 * Ao definir horário em um dia com outros dias ativos, sugere aplicar o mesmo intervalo.
 */
export function ProfessionalWeekSchedule({
  barberId,
  schedules,
  onUpdate,
  onApplyHours,
}: Props) {
  const [prompt, setPrompt] = useState<ApplyPrompt | null>(null)
  const [applying, setApplying] = useState(false)
  /** Se o usuário recusou aplicar, não insistir até ativar um novo dia. */
  const [skipApply, setSkipApply] = useState(false)

  const getSchedule = (day: number) =>
    schedules.find((s) => s.barber_id === barberId && s.day_of_week === day)

  const activeDays = DAY_NAMES.map((_, i) => i).filter((d) => getSchedule(d)?.is_active)

  const maybePromptApply = (sourceDay: number, start: string, end: string) => {
    if (skipApply) return
    const targets = activeDays.filter((d) => d !== sourceDay)
    if (targets.length === 0) return

    const needsSync = targets.some((d) => {
      const s = getSchedule(d)
      if (!s) return true
      return s.start_time?.slice(0, 5) !== start || s.end_time?.slice(0, 5) !== end
    })
    if (!needsSync) return

    setPrompt({ sourceDay, start, end, targetDays: targets })
  }

  const handleToggle = async (day: number, active: boolean) => {
    setPrompt(null)
    if (active) setSkipApply(false)
    await onUpdate(barberId, day, 'is_active', active)
  }

  const handleTimeChange = async (
    day: number,
    field: 'start_time' | 'end_time',
    value: string
  ) => {
    setPrompt(null)
    const sched = getSchedule(day)
    const start = field === 'start_time' ? value : sched?.start_time?.slice(0, 5) || '09:00'
    const end = field === 'end_time' ? value : sched?.end_time?.slice(0, 5) || '18:00'
    await onUpdate(barberId, day, field, value)
    maybePromptApply(day, start, end)
  }

  const acceptApply = async () => {
    if (!prompt) return
    setApplying(true)
    try {
      await onApplyHours(barberId, prompt.targetDays, prompt.start, prompt.end)
      setPrompt(null)
    } finally {
      setApplying(false)
    }
  }

  const declineApply = () => {
    setSkipApply(true)
    setPrompt(null)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-charcoal-muted">
        Marque os dias de trabalho e defina o intervalo. Se vários dias estiverem ativos, você
        poderá copiar o mesmo horário para todos.
      </p>

      <div className="space-y-2">
        {DAY_NAMES.map((dayName, dayIndex) => {
          const sched = getSchedule(dayIndex)
          const isActive = sched?.is_active ?? false
          const start = sched?.start_time?.slice(0, 5) || '09:00'
          const end = sched?.end_time?.slice(0, 5) || '18:00'
          const short = dayName.slice(0, 3)

          return (
            <div
              key={dayIndex}
              className={`rounded-xl border p-3 transition-colors ${
                isActive
                  ? 'border-brass/35 bg-brass/5'
                  : 'border-charcoal-light/60 bg-charcoal-light/20'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggle(dayIndex, !isActive)}
                  aria-pressed={isActive}
                  className={`flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                    isActive
                      ? 'bg-brass text-charcoal'
                      : 'bg-charcoal text-charcoal-muted hover:text-white'
                  }`}
                >
                  {short}
                </button>

                {isActive ? (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-charcoal-muted">
                      <span className="hidden sm:inline">Das</span>
                      <input
                        type="time"
                        value={start}
                        onChange={(e) => handleTimeChange(dayIndex, 'start_time', e.target.value)}
                        className="rounded-lg border border-charcoal-light bg-charcoal px-2.5 py-2 font-mono text-sm text-white focus:border-brass focus:outline-none"
                      />
                    </label>
                    <span className="text-charcoal-muted">às</span>
                    <label className="flex items-center gap-2 text-xs text-charcoal-muted">
                      <input
                        type="time"
                        value={end}
                        onChange={(e) => handleTimeChange(dayIndex, 'end_time', e.target.value)}
                        className="rounded-lg border border-charcoal-light bg-charcoal px-2.5 py-2 font-mono text-sm text-white focus:border-brass focus:outline-none"
                      />
                    </label>
                    <span className="ml-auto hidden font-mono text-xs text-brass/80 sm:inline">
                      {start} – {end}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-charcoal-muted">Folga</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {prompt && (
        <div
          role="dialog"
          aria-labelledby={`apply-hours-${barberId}`}
          className="rounded-xl border border-brass/50 bg-charcoal p-4 shadow-lg"
        >
          <p id={`apply-hours-${barberId}`} className="text-sm text-white">
            Aplicar{' '}
            <span className="font-mono text-brass">
              {prompt.start}–{prompt.end}
            </span>{' '}
            de {DAY_NAMES[prompt.sourceDay]} aos outros dias selecionados (
            {prompt.targetDays.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')})?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={applying}
              onClick={acceptApply}
              className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal disabled:opacity-50"
            >
              {applying ? 'Aplicando...' : 'Sim'}
            </button>
            <button
              type="button"
              disabled={applying}
              onClick={declineApply}
              className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:text-white disabled:opacity-50"
            >
              Não
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
