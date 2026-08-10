import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/format'
import {
  emptyRatingStats,
  fetchBarberRatingStatsMap,
  fetchShopRatingStats,
  fetchShopReviews,
} from '../../lib/reviews'
import { publicBookingPathForSegment } from '../../lib/segments'
import { DefaultAvatar, Skeleton } from '../../components/MediaUI'
import { BarberPole } from '../../components/BarberPole'
import { RatingBadge } from '../../components/reviews/StarRating'
import { ReviewsSection } from '../../components/reviews/ReviewsSection'
import type {
  Barber,
  BarberRatingStats,
  RatingStats,
  ReviewPublic,
  Service,
  Shop,
  ShopPhoto,
} from '../../lib/types'

export function ShopPublic() {
  const { slug } = useParams<{ slug: string }>()
  const [shop, setShop] = useState<Shop | null>(null)
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [shopStats, setShopStats] = useState<RatingStats | null>(null)
  const [barberStats, setBarberStats] = useState<Record<string, BarberRatingStats>>({})
  const [reviews, setReviews] = useState<ReviewPublic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    async function load() {
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .neq('subscription_status', 'blocked')
        .maybeSingle()

      if (!shopData) {
        setLoading(false)
        return
      }

      const [{ data: ph }, { data: barb }, { data: svc }, stats, bStats, rev] = await Promise.all([
        supabase
          .from('shop_photos')
          .select('*')
          .eq('shop_id', shopData.id)
          .order('sort_order'),
        supabase.from('barbers').select('*').eq('shop_id', shopData.id).order('name'),
        supabase.from('services').select('*').eq('shop_id', shopData.id).order('name'),
        fetchShopRatingStats(shopData.id),
        fetchBarberRatingStatsMap(shopData.id),
        fetchShopReviews(shopData.id, 12),
      ])

      setShop(shopData)
      setPhotos((ph as ShopPhoto[]) || [])
      setBarbers(barb || [])
      setServices(svc || [])
      setShopStats(stats)
      setBarberStats(bStats)
      setReviews(rev)
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-20 rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (!shop) {
    return <p className="text-center text-ink-muted">Estabelecimento não encontrado.</p>
  }

  const isPet = shop.segment === 'pet'
  const bookPath = publicBookingPathForSegment(shop.id, shop.segment)

  return (
    <div>
      <header className="mb-8">
        <div className="flex flex-wrap items-start gap-4">
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt={shop.name}
              className="h-20 w-20 shrink-0 rounded-xl border border-paper-dark object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-paper-dark bg-white font-display text-2xl text-brass">
              {shop.name.trim()[0]?.toUpperCase() || 'B'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {isPet && (
              <p className="text-xs uppercase tracking-widest text-brass font-medium mb-1">
                FIND PET
              </p>
            )}
            <h1 className="font-display text-3xl text-ink sm:text-4xl">{shop.name}</h1>
            {shop.slogan && (
              <p className="mt-1 text-ink-muted italic">{shop.slogan}</p>
            )}
            {shopStats && shopStats.review_count > 0 && (
              <RatingBadge
                avg={Number(shopStats.avg_rating)}
                count={shopStats.review_count}
                size="md"
                className="mt-2"
              />
            )}
            <BarberPole className="mt-4 max-w-xs" height="h-1.5" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={bookPath}
            className="rounded-lg bg-brass px-6 py-3 font-semibold text-charcoal hover:bg-brass-light transition-colors"
          >
            Agendar horário
          </Link>
          {shop.phone && (
            <a
              href={`https://wa.me/55${shop.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-paper-dark px-6 py-3 text-ink hover:border-brass transition-colors"
            >
              WhatsApp
            </a>
          )}
        </div>
      </header>

      {(shop.address || shop.hours_text || shop.phone) && (
        <div className="mb-10 rounded-lg border border-paper-dark bg-white p-5 text-sm text-ink-muted space-y-1">
          {shop.address && <p>{shop.address}</p>}
          {shop.hours_text && <p className="font-mono">{shop.hours_text}</p>}
          {shop.phone && <p>{shop.phone}</p>}
        </div>
      )}

      {photos.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-2xl text-ink mb-4">Ambiente</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <img
                key={p.id}
                src={p.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full rounded-lg object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {barbers.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-2xl text-ink mb-4">
            {isPet ? 'Profissionais' : 'Equipe'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {barbers.map((b) => {
              const stats = barberStats[b.id]
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border border-paper-dark bg-white p-4"
                >
                  {b.photo_url ? (
                    <img
                      src={b.photo_url}
                      alt={b.name}
                      loading="lazy"
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <DefaultAvatar name={b.name} className="h-14 w-14 text-xl" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{b.name}</p>
                    {b.role && <p className="text-sm text-ink-muted">{b.role}</p>}
                    {stats && stats.review_count > 0 && (
                      <RatingBadge
                        avg={Number(stats.avg_rating)}
                        count={stats.review_count}
                        className="mt-1"
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {services.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-2xl text-ink mb-4">Serviços</h2>
          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex justify-between rounded-lg border border-paper-dark bg-white px-4 py-3"
              >
                <span className="text-ink">{s.name}</span>
                <span className="font-mono text-brass">{formatPrice(Number(s.price))}</span>
              </div>
            ))}
          </div>
          <Link
            to={bookPath}
            className="mt-6 inline-block rounded-lg bg-brass px-6 py-3 font-semibold text-charcoal"
          >
            Agendar agora
          </Link>
        </section>
      )}

      <ReviewsSection
        stats={shopStats || emptyRatingStats()}
        reviews={reviews}
        showBarberName
        className="mb-10"
      />
    </div>
  )
}
