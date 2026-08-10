import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import {
  emptyRatingStats,
  fetchShopRatingStats,
  fetchShopReviewsForOwner,
  formatAvgRating,
} from '../../../../lib/reviews'
import type { RatingStats, ReviewPublic } from '../../../../lib/types'
import { ReviewsSection } from '../../../../components/reviews/ReviewsSection'
import { StarRating } from '../../../../components/reviews/StarRating'

interface Props {
  shopId: string
}

/** Avaliações do painel FIND PET — sem copy de barbearia. */
export function PetReviews({ shopId }: Props) {
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
        <h2 className="font-display text-2xl text-white mb-1">Avaliações do Pet Shop</h2>
        <p className="text-sm text-charcoal-muted">
          Reputação do pet shop com base em atendimentos de banho, tosa e cuidados concluídos no
          FIND PET.
        </p>
      </div>

      <div className="rounded-lg border border-charcoal-light bg-charcoal-light/40 p-6">
        {count === 0 ? (
          <div>
            <p className="font-display text-3xl text-brass mb-2">—</p>
            <p className="text-sm text-charcoal-muted">
              Ainda não há avaliações. Quando um atendimento for finalizado, o cliente poderá
              avaliar o pet shop.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="font-display text-5xl text-brass leading-none">
                {formatAvgRating(avg)}
              </p>
              <StarRating value={Number(avg)} size="md" className="mt-2" />
            </div>
            <p className="text-sm text-charcoal-muted pb-1">
              {count} {count === 1 ? 'avaliação' : 'avaliações'}
            </p>
          </div>
        )}
        {awaitingCount > 0 && (
          <p className="mt-4 text-sm text-brass">
            {awaitingCount} atendimento{awaitingCount > 1 ? 's' : ''} aguardando avaliação do
            cliente.
          </p>
        )}
      </div>

      <ReviewsSection stats={stats || emptyRatingStats()} reviews={reviews} showBarberName />
    </div>
  )
}
