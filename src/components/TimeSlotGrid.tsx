import { formatTime } from '../lib/format'

interface Props {
  slots: string[]
  selected: string | null
  onSelect: (time: string) => void
  emptyMessage?: string
}

type Period = 'morning' | 'afternoon' | 'evening'

const PERIOD_META: Record<Period, { label: string; hint: string }> = {
  morning: { label: 'Manhã', hint: 'até 11:59' },
  afternoon: { label: 'Tarde', hint: '12:00 – 17:59' },
  evening: { label: 'Noite', hint: 'a partir de 18:00' },
}

function periodOf(time: string): Period {
  const hour = Number(time.slice(0, 2))
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function groupSlots(slots: string[]): { period: Period; times: string[] }[] {
  const buckets: Record<Period, string[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  }
  for (const t of slots) {
    buckets[periodOf(t)].push(t)
  }
  return (['morning', 'afternoon', 'evening'] as Period[])
    .filter((p) => buckets[p].length > 0)
    .map((period) => ({ period, times: buckets[period] }))
}

/** Grade de horários para o fluxo público de agendamento (barbearia e pet). */
export function TimeSlotGrid({
  slots,
  selected,
  onSelect,
  emptyMessage = 'Nenhum horário disponível nesta data.',
}: Props) {
  if (slots.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyMessage}</p>
  }

  const groups = groupSlots(slots)

  return (
    <div className="space-y-5">
      {groups.map(({ period, times }) => {
        const meta = PERIOD_META[period]
        return (
          <div key={period}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-medium text-ink">{meta.label}</h4>
              <span className="text-[11px] text-ink-muted">{meta.hint}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {times.map((t) => {
                const isSelected = selected === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onSelect(t)}
                    aria-pressed={isSelected}
                    className={`rounded-xl border py-2.5 font-mono text-sm transition-all ${
                      isSelected
                        ? 'border-brass bg-brass text-charcoal shadow-sm ring-2 ring-brass/30'
                        : 'border-transparent bg-paper text-ink hover:border-brass/40 hover:bg-paper-dark'
                    }`}
                  >
                    {formatTime(t)}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
