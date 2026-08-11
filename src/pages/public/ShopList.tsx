import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/format'
import { fetchShopRatingStatsMap } from '../../lib/reviews'
import { getSegment, publicBookingPathForSegment } from '../../lib/segments'
import type { Shop, Service, ShopSegment, ShopRatingStats } from '../../lib/types'
import { BrandAccent } from '../../components/BrandAccent'
import { RatingBadge } from '../../components/reviews/StarRating'

interface ShopWithServices extends Shop {
  services: Service[]
  rating?: ShopRatingStats | null
  fromPrice?: number | null
}

interface Props {
  segment: ShopSegment
}

export function ShopList({ segment }: Props) {
  const meta = getSegment(segment)
  const isPet = segment === 'pet'
  const [shops, setShops] = useState<ShopWithServices[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: shopsData } = await supabase
        .from('shops')
        .select('*')
        .eq('segment', segment)
        .neq('subscription_status', 'blocked')
        .order('name')

      if (!shopsData) {
        setShops([])
        setLoading(false)
        return
      }

      const ratingMap = await fetchShopRatingStatsMap(shopsData.map((s) => s.id))

      const withServices = await Promise.all(
        shopsData.map(async (shop) => {
          const { data: services } = await supabase
            .from('services')
            .select('*')
            .eq('shop_id', shop.id)
            .eq('is_active', true)
            .order('price')
            .limit(isPet ? 6 : 3)
          const list = services || []
          const prices = list.map((s) => Number(s.price)).filter((n) => !Number.isNaN(n))
          return {
            ...shop,
            services: list.slice(0, isPet ? 4 : 3),
            fromPrice: prices.length ? Math.min(...prices) : null,
            rating: ratingMap[shop.id] || null,
          }
        })
      )

      setShops(withServices)
      setLoading(false)
    }
    load()
  }, [segment, isPet])

  if (loading) {
    return <p className="text-center text-ink-muted">Carregando...</p>
  }

  return (
    <div>
      <div className="mb-2">
        <Link to="/" className="text-xs uppercase tracking-widest text-brass hover:underline">
          ← FIND
        </Link>
      </div>

      <div className="mb-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-brass font-medium mb-2">
          {meta.brandName}
        </p>
        <h1 className="font-display text-4xl text-ink mb-2 sm:text-5xl">{meta.listTitle}</h1>
        <BrandAccent className="mx-auto max-w-xs mb-4" segment={segment} />
        <p className="text-ink-muted max-w-xl mx-auto">{meta.listSubtitle}</p>
        {isPet && (
          <p className="mt-3 text-xs uppercase tracking-widest text-ink-muted">
            Pet shops · Banho e tosa · Cuidados
          </p>
        )}
      </div>

      {shops.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-ink-muted mb-4">
            {isPet
              ? 'Nenhum pet shop disponível no momento.'
              : `Nenhuma ${meta.businessLabel.toLowerCase()} disponível no momento.`}
          </p>
          <Link
            to={`/painel?segment=${segment}&modo=cadastro`}
            className="text-sm text-brass hover:underline"
          >
            Seja o primeiro — cadastre {segment === 'pet' ? 'seu pet shop' : 'sua barbearia'}
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {shops.map((shop) => {
            const href = shop.slug
              ? `/b/${shop.slug}`
              : publicBookingPathForSegment(shop.id, shop.segment)
            return (
              <Link
                key={shop.id}
                to={href}
                className={`group block rounded-xl border border-paper-dark bg-white/90 p-6 shadow-sm transition-all hover:shadow-md hover:border-brass/40 ${
                  isPet ? 'backdrop-blur-sm' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {shop.logo_url ? (
                    <img
                      src={shop.logo_url}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 rounded-xl object-cover border border-paper-dark"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-paper-dark bg-paper font-display text-xl text-brass">
                      {shop.name.trim()[0]?.toUpperCase() || 'P'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-2xl text-ink group-hover:text-brass transition-colors">
                      {shop.name}
                    </h2>
                    {shop.slogan && (
                      <p className="text-sm text-ink-muted italic mt-1 line-clamp-2">{shop.slogan}</p>
                    )}
                    {shop.rating && shop.rating.review_count > 0 && (
                      <RatingBadge
                        avg={Number(shop.rating.avg_rating)}
                        count={shop.rating.review_count}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>
                {shop.address && (
                  <p className="text-sm text-ink-muted mt-3 line-clamp-1">{shop.address}</p>
                )}
                {shop.services.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {shop.services.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-md bg-paper px-2.5 py-1 text-xs text-ink-muted"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-sm text-ink-muted">
                    {shop.fromPrice != null ? (
                      <>
                        A partir de{' '}
                        <span className="font-mono text-ink">{formatPrice(shop.fromPrice)}</span>
                      </>
                    ) : (
                      'Ver serviços'
                    )}
                  </span>
                  <span className="text-sm font-semibold text-brass">Agendar →</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
