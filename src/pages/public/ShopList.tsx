import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/format'
import { fetchShopRatingStatsMap } from '../../lib/reviews'
import { getSegment, publicBookingPathForSegment } from '../../lib/segments'
import type { Shop, Service, ShopSegment, ShopRatingStats } from '../../lib/types'
import { BarberPole } from '../../components/BarberPole'
import { RatingBadge } from '../../components/reviews/StarRating'

interface ShopWithServices extends Shop {
  services: Service[]
  rating?: ShopRatingStats | null
}

interface Props {
  segment: ShopSegment
}

export function ShopList({ segment }: Props) {
  const meta = getSegment(segment)
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
            .limit(3)
          return {
            ...shop,
            services: services || [],
            rating: ratingMap[shop.id] || null,
          }
        })
      )

      setShops(withServices)
      setLoading(false)
    }
    load()
  }, [segment])

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
        <h1 className="font-display text-5xl text-ink mb-2">{meta.listTitle}</h1>
        <BarberPole className="mx-auto max-w-xs mb-4" />
        <p className="text-ink-muted">{meta.listSubtitle}</p>
      </div>

      {shops.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-ink-muted mb-4">
            Nenhum estabelecimento {meta.shortName.toLowerCase()} disponível no momento.
          </p>
          <Link
            to={`/painel?segment=${segment}&modo=cadastro`}
            className="text-sm text-brass hover:underline"
          >
            Seja o primeiro — cadastre seu {meta.professionalLabel}
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
                className="group rounded-lg border border-paper-dark bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  {shop.logo_url && (
                    <img
                      src={shop.logo_url}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl text-ink group-hover:text-brass transition-colors">
                      {shop.name}
                    </h2>
                    {shop.slogan && (
                      <p className="text-sm text-ink-muted italic mt-1">{shop.slogan}</p>
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
                  <p className="text-sm text-ink-muted mt-2">{shop.address}</p>
                )}
                {shop.services.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {shop.services.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-paper px-3 py-1 text-xs font-mono text-ink-muted"
                      >
                        {s.name} · {formatPrice(Number(s.price))}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-4 text-sm font-medium text-brass">Agendar →</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
