import { RATING_LABELS } from '../../lib/reviews'

interface StarRatingProps {
  value: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Fundo claro (público) ou escuro (dashboard) */
  tone?: 'light' | 'dark'
}

const SIZE = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
} as const

export function StarRating({
  value,
  size = 'md',
  className = '',
  tone = 'light',
}: StarRatingProps) {
  const filled = Math.round(Math.min(5, Math.max(0, value)))
  const active = tone === 'dark' ? 'text-brass' : 'text-brass'
  const inactive = tone === 'dark' ? 'text-charcoal-muted/40' : 'text-paper-dark'

  return (
    <span
      className={`inline-flex items-center gap-0.5 leading-none ${SIZE[size]} ${className}`}
      aria-label={`${filled} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`star-glyph transition-colors duration-200 ${n <= filled ? active : inactive}`}
        >
          ★
        </span>
      ))}
    </span>
  )
}

interface StarPickerProps {
  value: number
  onChange: (rating: number) => void
  disabled?: boolean
}

export function StarPicker({ value, onChange, disabled }: StarPickerProps) {
  return (
    <div className="text-center">
      <div
        className="inline-flex items-center gap-1 sm:gap-2"
        role="radiogroup"
        aria-label="Nota de 1 a 5 estrelas"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = n <= value
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
              disabled={disabled}
              onClick={() => onChange(n)}
              onMouseEnter={(e) => {
                if (disabled) return
                const parent = e.currentTarget.parentElement
                if (!parent) return
                parent.querySelectorAll<HTMLButtonElement>('button').forEach((btn, i) => {
                  btn.classList.toggle('star-hover-on', i < n)
                })
              }}
              onMouseLeave={(e) => {
                const parent = e.currentTarget.parentElement
                if (!parent) return
                parent.querySelectorAll('button').forEach((btn) => {
                  btn.classList.remove('star-hover-on')
                })
              }}
              className={`star-pick text-4xl sm:text-5xl leading-none transition-transform duration-200 ease-out disabled:opacity-50 ${
                selected ? 'text-brass scale-110' : 'text-paper-dark'
              } hover:scale-125 active:scale-95`}
            >
              ★
            </button>
          )
        })}
      </div>
      <p
        className={`mt-3 text-sm transition-opacity duration-200 ${
          value ? 'text-ink opacity-100' : 'text-ink-muted opacity-70'
        }`}
      >
        {value ? RATING_LABELS[value] : 'Toque nas estrelas para avaliar'}
      </p>
    </div>
  )
}

interface RatingBadgeProps {
  avg: number
  count: number
  size?: 'sm' | 'md'
  className?: string
  tone?: 'light' | 'dark'
}

export function RatingBadge({
  avg,
  count,
  size = 'sm',
  className = '',
  tone = 'light',
}: RatingBadgeProps) {
  if (!count) {
    return (
      <p
        className={`text-xs ${tone === 'dark' ? 'text-charcoal-muted' : 'text-ink-muted'} ${className}`}
      >
        Sem avaliações ainda
      </p>
    )
  }

  const avgText = Number(avg).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const muted = tone === 'dark' ? 'text-charcoal-muted' : 'text-ink-muted'

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <StarRating value={avg} size={size === 'sm' ? 'sm' : 'md'} tone={tone} />
      <span
        className={`font-mono font-medium text-brass ${size === 'sm' ? 'text-sm' : 'text-base'}`}
      >
        {avgText}
      </span>
      <span className={`${muted} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        · {count} {count === 1 ? 'avaliação' : 'avaliações'}
      </span>
    </div>
  )
}
