import { formatRelativeTime } from '../../lib/format'
import { formatAvgRating, starDistribution } from '../../lib/reviews'
import type { RatingStats, ReviewPublic } from '../../lib/types'
import { StarRating } from './StarRating'

interface Props {
  stats: RatingStats | null
  reviews: ReviewPublic[]
  /** Mostra nome do barbeiro em cada item (útil na página da loja) */
  showBarberName?: boolean
  title?: string
  tone?: 'light' | 'dark'
  className?: string
}

export function ReviewsSection({
  stats,
  reviews,
  showBarberName = true,
  title = 'Avaliações',
  tone = 'light',
  className = '',
}: Props) {
  const isDark = tone === 'dark'
  const count = stats?.review_count ?? 0
  const avg = stats?.avg_rating ?? 0
  const distribution = stats ? starDistribution(stats) : []

  const card = isDark
    ? 'rounded-lg border border-charcoal-light bg-charcoal-light/30 p-4'
    : 'rounded-lg border border-paper-dark bg-white p-4'
  const titleCls = isDark ? 'text-white' : 'text-ink'
  const muted = isDark ? 'text-charcoal-muted' : 'text-ink-muted'
  const barTrack = isDark ? 'bg-charcoal-light' : 'bg-paper-dark/60'
  const barFill = 'bg-brass'

  if (!count) {
    return (
      <section className={className}>
        <h2 className={`font-display text-2xl ${titleCls} mb-3`}>{title}</h2>
        <p className={`text-sm ${muted}`}>Ainda não há avaliações. Seja o primeiro após concluir um atendimento.</p>
      </section>
    )
  }

  return (
    <section className={className}>
      <h2 className={`font-display text-2xl ${titleCls} mb-4`}>{title}</h2>

      <div className={`${card} mb-6`}>
        <div className="flex flex-wrap items-end gap-4 mb-5">
          <div>
            <p className={`font-mono text-4xl font-semibold text-brass leading-none`}>
              {formatAvgRating(avg)}
            </p>
            <StarRating value={avg} size="md" tone={tone} className="mt-2" />
            <p className={`mt-1 text-sm ${muted}`}>
              {count} {count === 1 ? 'avaliação' : 'avaliações'}
            </p>
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            {distribution.map((row) => (
              <div key={row.stars} className="flex items-center gap-2 text-xs">
                <span className={`w-14 shrink-0 font-mono ${muted}`}>
                  {'★'.repeat(row.stars)}
                  <span className="opacity-30">{'★'.repeat(5 - row.stars)}</span>
                </span>
                <div className={`h-1.5 flex-1 overflow-hidden rounded-full ${barTrack}`}>
                  <div
                    className={`h-full rounded-full ${barFill} transition-all duration-500`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <span className={`w-8 text-right font-mono ${muted}`}>{row.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <article key={review.id} className={card}>
            <StarRating value={review.rating} size="sm" tone={tone} />
            {review.comment && (
              <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-white/90' : 'text-ink'}`}>
                “{review.comment}”
              </p>
            )}
            <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs ${muted}`}>
              <VerifiedBadge tone={tone} />
              {showBarberName && review.barbers?.name && (
                <>
                  <span aria-hidden>·</span>
                  <span>{review.barbers.name}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <time dateTime={review.created_at}>{formatRelativeTime(review.created_at)}</time>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function VerifiedBadge({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const cls =
    tone === 'dark'
      ? 'bg-brass/15 text-brass'
      : 'bg-brass/10 text-brass'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${cls}`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-sm bg-current" />
      Cliente verificado
    </span>
  )
}
