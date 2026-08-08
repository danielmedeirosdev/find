import { supabase } from './supabase'
import type {
  BarberRatingStats,
  RatingStats,
  Review,
  ReviewPublic,
  ShopRatingStats,
} from './types'

export const RATING_LABELS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Muito bom',
  5: 'Excelente',
}

export function emptyRatingStats(): RatingStats {
  return {
    avg_rating: 0,
    review_count: 0,
    star_5: 0,
    star_4: 0,
    star_3: 0,
    star_2: 0,
    star_1: 0,
  }
}

export function starDistribution(stats: RatingStats): Array<{ stars: number; count: number; pct: number }> {
  const total = stats.review_count || 0
  const counts = [stats.star_5, stats.star_4, stats.star_3, stats.star_2, stats.star_1]
  return [5, 4, 3, 2, 1].map((stars, i) => ({
    stars,
    count: counts[i],
    pct: total > 0 ? Math.round((counts[i] / total) * 100) : 0,
  }))
}

export function formatAvgRating(avg: number | null | undefined): string {
  if (avg == null || Number.isNaN(Number(avg))) return '—'
  return Number(avg).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export async function fetchShopRatingStats(shopId: string): Promise<ShopRatingStats | null> {
  const { data } = await supabase
    .from('shop_rating_stats')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle()
  return (data as ShopRatingStats) || null
}

export async function fetchShopRatingStatsMap(
  shopIds: string[]
): Promise<Record<string, ShopRatingStats>> {
  if (shopIds.length === 0) return {}
  const { data } = await supabase.from('shop_rating_stats').select('*').in('shop_id', shopIds)
  const map: Record<string, ShopRatingStats> = {}
  for (const row of (data as ShopRatingStats[]) || []) {
    map[row.shop_id] = row
  }
  return map
}

export async function fetchBarberRatingStatsMap(
  shopId: string
): Promise<Record<string, BarberRatingStats>> {
  const { data } = await supabase.from('barber_rating_stats').select('*').eq('shop_id', shopId)
  const map: Record<string, BarberRatingStats> = {}
  for (const row of (data as BarberRatingStats[]) || []) {
    map[row.barber_id] = row
  }
  return map
}

export async function fetchShopReviews(
  shopId: string,
  limit = 20
): Promise<ReviewPublic[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*, barbers(id, name, photo_url)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as ReviewPublic[]) || []
}

export async function fetchBarberReviews(
  barberId: string,
  limit = 20
): Promise<Review[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('barber_id', barberId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as Review[]) || []
}

export async function fetchShopReviewsForOwner(
  shopId: string,
  limit = 50
): Promise<ReviewPublic[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*, barbers(id, name, photo_url)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as ReviewPublic[]) || []
}

export async function submitReview(
  bookingId: string,
  rating: number,
  comment?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('submit_review', {
    p_booking_id: bookingId,
    p_rating: rating,
    p_comment: comment?.trim() || null,
  })
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) {
      throw new Error(
        'Função de avaliação não encontrada. Execute as migrations 012 e 013 no Supabase.'
      )
    }
    throw new Error(error.message)
  }
  return data as string
}
