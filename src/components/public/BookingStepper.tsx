type StepItem = {
  n: number
  label: string
}

export function BookingStepper({
  steps,
  current,
  tone = 'light',
}: {
  steps: StepItem[]
  current: number
  tone?: 'light' | 'dark'
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
                      ? tone === 'dark' ? 'bg-white/15 text-white' : 'bg-ink text-paper'
                      : tone === 'dark' ? 'bg-white/5 text-charcoal-muted' : 'bg-paper-dark text-ink-muted'
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
                className={`w-full text-[10px] font-medium uppercase tracking-wide ${
                  tone === 'dark' ? active ? 'text-white' : 'text-charcoal-muted' : active ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
      <div className={`mt-3 h-1 overflow-hidden rounded-full ${tone === 'dark' ? 'bg-white/10' : 'bg-paper-dark'}`}>
        <div
          className="h-full rounded-full bg-brass transition-[width] duration-300"
          style={{ width: `${(current / steps.length) * 100}%` }}
        />
      </div>
    </nav>
  )
}
