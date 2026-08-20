import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice, formatDuration } from '../../lib/format'
import {
  emptyRatingStats,
  fetchBarberRatingStatsMap,
  fetchShopRatingStats,
  fetchShopReviews,
} from '../../lib/reviews'
import { getSegment, publicBookingPathForSegment } from '../../lib/segments'
import { SegmentProvider } from '../../contexts/SegmentContext'
import { DefaultAvatar, Skeleton } from '../../components/MediaUI'
import { BrandAccent } from '../../components/BrandAccent'
import { BackArrow } from '../../components/SegmentMark'
import { RatingBadge } from '../../components/reviews/StarRating'
import { ReviewsSection } from '../../components/reviews/ReviewsSection'
import type {
  PublicBarber,
  BarberRatingStats,
  RatingStats,
  ReviewPublic,
  Service,
  PublicShop,
  ShopPhoto,
} from '../../lib/types'

export function ShopPublic() {
  const { slug } = useParams<{ slug: string }>()
  const [shop, setShop] = useState<PublicShop | null>(null)
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [barbers, setBarbers] = useState<PublicBarber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [shopStats, setShopStats] = useState<RatingStats | null>(null)
  const [barberStats, setBarberStats] = useState<Record<string, BarberRatingStats>>({})
  const [reviews, setReviews] = useState<ReviewPublic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    async function load() {
      const { data: shopData } = await supabase
        .from('public_shops')
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
        supabase.from('public_barbers').select('*').eq('shop_id', shopData.id).order('name'),
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
  const seg = getSegment(shop.segment)
  const bookPath = publicBookingPathForSegment(shop.id, shop.segment)

  return (
    <SegmentProvider segment={shop.segment}>
    <div className={`${isPet ? 'pet-hero-glow -mx-4 px-4 py-6 rounded-2xl' : ''} pb-24 sm:pb-0`}>
      <Link
        to={seg.path}
        className="mb-5 inline-flex items-center text-xs font-semibold uppercase tracking-widest text-brass hover:underline"
      >
        <BackArrow className="h-2.5 w-2.5" />
        {isPet ? 'Pet shops' : 'Barbearias'}
      </Link>
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
              {shop.name.trim()[0]?.toUpperCase() || (isPet ? 'P' : 'B')}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-brass font-medium mb-1">
              {seg.brandName}
            </p>
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
            <BrandAccent className="mt-4 max-w-xs" height="h-1.5" segment={seg.id} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={bookPath} className="btn-primary">
            Agendar horário
          </Link>
          {shop.phone && (
            <a
              href={`https://wa.me/55${shop.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              WhatsApp
            </a>
          )}
        </div>
      </header>

      {(shop.address || shop.hours_text || shop.phone) && (
        <div className="mb-10 grid gap-3 rounded-2xl border border-paper-dark bg-white p-5 text-sm sm:grid-cols-3">
          {shop.address && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Endereço
              </p>
              <p className="mt-1 text-ink">{shop.address}</p>
            </div>
          )}
          {shop.hours_text && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Horário
              </p>
              <p className="mt-1 text-ink">{shop.hours_text}</p>
            </div>
          )}
          {shop.phone && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Telefone
              </p>
              <p className="mt-1 text-ink">{shop.phone}</p>
            </div>
          )}
        </div>
      )}

      {photos.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-2xl text-ink mb-4">{seg.publicEnvTitle}</h2>
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
                className="flex items-center justify-between gap-4 rounded-xl border border-paper-dark bg-white px-4 py-3.5"
              >
                <div>
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-ink-muted">{formatDuration(s.duration_minutes)}</p>
                </div>
                <span className="tabular-nums font-semibold text-brass">{formatPrice(Number(s.price))}</span>
              </div>
            ))}
          </div>
          <Link to={bookPath} className="btn-primary mt-6 inline-flex">
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

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-paper-dark bg-paper/95 p-3 backdrop-blur sm:hidden">
        <Link to={bookPath} className="btn-primary flex w-full justify-center">
          Agendar horário
        </Link>
      </div>
    </div>
    </SegmentProvider>
  )
}
