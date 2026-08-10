import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  emptyRatingStats,
  fetchShopRatingStats,
  fetchShopReviewsForOwner,
  formatAvgRating,
} from '../../../lib/reviews'
import type { RatingStats, ReviewPublic, ShopSegment } from '../../../lib/types'
import { getSegment } from '../../../lib/segments'
import { ReviewsSection } from '../../../components/reviews/ReviewsSection'
import { StarRating } from '../../../components/reviews/StarRating'

interface Props {
  shopId: string
  segment?: string | null
}

export function ReviewsTab({ shopId, segment }: Props) {
  const seg = getSegment(segment as ShopSegment)
  const [stats, setStats] = useState<RatingStats | null>(null)
  const [reviews, setReviews] = useState<ReviewPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [awaitingCount, setAwaitingCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const [shopStats, list, awaiting] = await Promise.all([
      fetchShopRatingStats(shopId),
      fetchShopReviewsForOwner(shopId, 50),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('review_status', 'awaiting'),
    ])
    setStats(shopStats || emptyRatingStats())
    setReviews(list)
    setAwaitingCount(awaiting.count || 0)
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <p className="text-charcoal-muted">Carregando avaliações...</p>
  }

  const count = stats?.review_count ?? 0
  const avg = stats?.avg_rating ?? 0

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-2xl text-white mb-1">Sua avaliação</h2>
        <p className="text-sm text-charcoal-muted">
          Reputação d{seg.deleteArticle} {seg.businessLabel.toLowerCase()} com base em
          atendimentos concluídos no FIND.
        </p>
      </div>

      <div className="rounded-lg border border-charcoal-light bg-charcoal-light/40 p-6">
        {count === 0 ? (
          <div>
            <p className="font-display text-3xl text-brass mb-2">—</p>
            <p className="text-sm text-charcoal-muted">
              Ainda não há avaliações. Cada cliente pode avaliar uma única vez, no primeiro
              atendimento concluído.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-charcoal-muted mb-1">Média geral</p>
              <p className="font-mono text-5xl font-semibold text-brass leading-none">
                {formatAvgRating(avg)}
              </p>
              <StarRating value={avg} size="lg" tone="dark" className="mt-3" />
            </div>
            <div className="text-sm text-charcoal-muted space-y-1">
              <p>
                <span className="font-mono text-white text-lg">{count}</span>{' '}
                {count === 1 ? 'avaliação' : 'avaliações'}
              </p>
              {awaitingCount > 0 && (
                <p>
                  {awaitingCount}{' '}
                  {awaitingCount === 1
                    ? 'atendimento aguardando avaliação'
                    : 'atendimentos aguardando avaliação'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <ReviewsSection
        stats={stats}
        reviews={reviews}
        showBarberName
        title="Avaliações recentes"
        tone="dark"
      />
    </div>
  )
}
