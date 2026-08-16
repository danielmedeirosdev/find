type StepItem = {
  n: number
  label: string
}

export function BookingStepper({
  steps,
  current,
}: {
  steps: StepItem[]
  current: number
}) {
  return (
    <nav aria-label="Etapas do agendamento" className="mb-8">
      <ol
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step) => {
          const done = current > step.n
          const active = current === step.n
          return (
            <li key={step.n} className="flex min-w-0 flex-col items-center gap-2 text-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  active
                    ? 'bg-brass text-charcoal'
                    : done
                      ? 'bg-ink text-paper'
                      : 'bg-paper-dark text-ink-muted'
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6.2 4.7 9 10 3" />
                  </svg>
                ) : (
                  step.n
                )}
              </span>
              <span
                className={`w-full truncate text-[11px] font-medium uppercase tracking-wide ${
                  active ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-paper-dark">
        <div
          className="h-full rounded-full bg-brass transition-[width] duration-300"
          style={{ width: `${(current / steps.length) * 100}%` }}
        />
      </div>
    </nav>
  )
}
