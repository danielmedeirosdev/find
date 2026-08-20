import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/format'
import { foldText } from '../../lib/location'
import {
  NEARBY_KM,
  addressMatchesPlace,
  formatDistanceKm,
  geocodeAddress,
  geoStatusFromError,
  getUserPlace,
  haversineKm,
  type Coords,
  type GeoStatus,
  type PlaceHint,
} from '../../lib/geo'
import { fetchShopRatingStatsMap } from '../../lib/reviews'
import { getSegment, publicBookingPathForSegment } from '../../lib/segments'
import type { PublicShop, Service, ShopSegment, ShopRatingStats } from '../../lib/types'
import { BrandAccent } from '../../components/BrandAccent'
import { CtaArrow, BackArrow, SearchMark } from '../../components/SegmentMark'
import { RatingBadge } from '../../components/reviews/StarRating'
import { PageLoader, ShopCardSkeleton } from '../../components/public/PageLoader'
import { ReferralLandingSection } from '../../components/ReferralLandingSection'

interface ShopWithServices extends PublicShop {
  services: Service[]
  rating?: ShopRatingStats | null
  fromPrice?: number | null
  coords?: Coords | null
  distanceKm?: number | null
}

interface Props {
  segment: ShopSegment
}

export function ShopList({ segment }: Props) {
  const meta = getSegment(segment)
  const isPet = segment === 'pet'
  const [shops, setShops] = useState<ShopWithServices[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('asking')
  const [userCoords, setUserCoords] = useState<Coords | null>(null)
  const [place, setPlace] = useState<PlaceHint | null>(null)

  useEffect(() => {
    setQuery('')
  }, [segment])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: shopsData } = await supabase
        .from('public_shops')
        .select('*')
        .eq('segment', segment)
        .neq('subscription_status', 'blocked')
        .order('name')

      if (cancelled) return
      if (!shopsData) {
        setShops([])
        setLoading(false)
        return
      }

      const ratingMap = await fetchShopRatingStatsMap(shopsData.map((s) => s.id))
      if (cancelled) return

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
            coords: null,
            distanceKm: null,
          } satisfies ShopWithServices
        })
      )

      if (!cancelled) {
        setShops(withServices)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [segment, isPet])

  useEffect(() => {
    let cancelled = false
    async function locate() {
      setGeoStatus('asking')
      try {
        const result = await getUserPlace()
        if (cancelled) return
        setUserCoords(result.coords)
        setPlace(result.place)
        setGeoStatus('ready')
      } catch (err) {
        if (cancelled) return
        setUserCoords(null)
        setPlace(null)
        setGeoStatus(geoStatusFromError(err))
      }
    }
    locate()
    return () => {
      cancelled = true
    }
  }, [segment])

  const shopKey = shops.map((shop) => shop.id).join('|')

  useEffect(() => {
    if (!shopKey || !userCoords) return
    let cancelled = false
    const snapshot = shops
    async function locateShops() {
      const located = await Promise.all(
        snapshot.map(async (shop) => {
          if (!shop.address) return { id: shop.id, coords: null as Coords | null }
          const coords = await geocodeAddress(shop.address, userCoords)
          return { id: shop.id, coords }
        })
      )
      if (cancelled) return
      setShops((current) =>
        current.map((shop) => {
          const match = located.find((item) => item.id === shop.id)
          return match ? { ...shop, coords: match.coords } : shop
        })
      )
    }
    locateShops()
    return () => {
      cancelled = true
    }
  }, [shopKey, userCoords, segment])

  const locatedShops = useMemo(() => {
    return shops.map((shop) => {
      const distanceKm =
        userCoords && shop.coords ? haversineKm(userCoords, shop.coords) : null
      const nearby =
        (distanceKm != null && distanceKm <= NEARBY_KM) ||
        addressMatchesPlace(shop.address, place)
      return { ...shop, distanceKm, nearby }
    })
  }, [shops, userCoords, place])

  const nearbyCount = locatedShops.filter((shop) => shop.nearby).length
  const geoFilterOn = geoStatus === 'ready' && nearbyCount > 0

  const filteredShops = useMemo(() => {
    const q = foldText(query)
    const pool = geoFilterOn ? locatedShops.filter((shop) => shop.nearby) : locatedShops
    const matched = pool.filter((shop) => {
      if (!q) return true
      const haystack = foldText(
        [shop.name, shop.slogan, shop.address, ...shop.services.map((service) => service.name)]
          .filter(Boolean)
          .join(' ')
      )
      return haystack.includes(q)
    })
    return matched.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm
      if (a.distanceKm != null) return -1
      if (b.distanceKm != null) return 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [locatedShops, query, geoFilterOn])

  const hasSearch = Boolean(query.trim())

  if (loading) {
    return (
      <div>
        <PageLoader label={`Carregando ${isPet ? 'pet shops' : 'barbearias'}`} />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
          <ShopCardSkeleton />
          <ShopCardSkeleton />
          <ShopCardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2">
        <Link to="/" className="inline-flex items-center text-xs font-semibold uppercase tracking-widest text-brass hover:underline">
          <BackArrow className="h-2.5 w-2.5" />
          Início
        </Link>
      </div>

      <div className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-brass font-medium mb-2">
          {meta.brandName}
        </p>
        <h1 className="font-display text-4xl text-ink mb-2 sm:text-5xl">{meta.listTitle}</h1>
        <BrandAccent className="mx-auto max-w-xs mb-4" segment={segment} />
        <p className="text-ink-muted max-w-xl mx-auto">{meta.listSubtitle}</p>
        {isPet && (
          <p className="mt-3 text-xs uppercase tracking-widest text-ink-muted">
            Banho · Tosa · Cuidados
          </p>
        )}
        {geoStatus === 'ready' && place?.label && (
          <p className="mt-3 text-sm text-ink-muted">
            Perto de <span className="font-medium text-ink">{place.label}</span>
            {geoFilterOn ? ' · mostrando os mais próximos' : ''}
          </p>
        )}
      </div>

      {shops.length > 0 && (
        <div className="mb-8">
          <label className="relative mx-auto block w-full max-w-xl">
            <span className="sr-only">Buscar {isPet ? 'pet shop' : 'barbearia'}</span>
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-muted">
              <SearchMark />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isPet ? 'Buscar pet shop, bairro ou serviço' : 'Buscar barbearia, bairro ou serviço'}
              className="w-full rounded-xl border border-ink/10 bg-white/90 py-3 pl-10 pr-4 text-sm text-ink shadow-sm placeholder:text-ink-muted/60 focus:border-brass/60 focus:outline-none"
            />
          </label>
        </div>
      )}

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
            Seja o primeiro. Cadastre {segment === 'pet' ? 'seu pet shop' : 'sua barbearia'}
          </Link>
        </div>
      ) : filteredShops.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-ink-muted mb-4">Nenhum negócio encontrado para essa busca.</p>
          {hasSearch && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-sm text-brass hover:underline"
            >
              Limpar busca
            </button>
          )}
        </div>
      ) : (
        <div
          className={
            filteredShops.length === 1
              ? 'max-w-md'
              : 'grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3'
          }
        >
          {filteredShops.map((shop) => {
            const href = shop.slug
              ? `/b/${shop.slug}`
              : publicBookingPathForSegment(shop.id, shop.segment)
            return (
              <Link
                key={shop.id}
                to={href}
                className={`group block h-full rounded-2xl border border-paper-dark bg-white/95 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brass/40 hover:shadow-md sm:p-5 ${
                  isPet ? 'backdrop-blur-sm' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {shop.logo_url ? (
                    <img
                      src={shop.logo_url}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-lg object-cover border border-paper-dark sm:h-14 sm:w-14 sm:rounded-xl"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-paper-dark bg-paper font-display text-lg text-brass sm:h-14 sm:w-14 sm:rounded-xl sm:text-xl">
                      {shop.name.trim()[0]?.toUpperCase() || 'P'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-xl leading-tight text-ink transition-colors group-hover:text-brass sm:text-2xl">
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
                {(shop.address || shop.distanceKm != null) && (
                  <p className="text-sm text-ink-muted mt-3 line-clamp-1">
                    {shop.distanceKm != null && (
                      <span className="text-ink">a {formatDistanceKm(shop.distanceKm)} · </span>
                    )}
                    {shop.address}
                  </p>
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
                        <span className="font-semibold tabular-nums text-ink">{formatPrice(shop.fromPrice)}</span>
                      </>
                    ) : (
                      'Ver serviços'
                    )}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-brass px-3 py-1.5 text-sm font-semibold text-charcoal">
                    Agendar
                    <CtaArrow />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="mt-16 rounded-2xl border border-ink/10 bg-white/80 px-5 py-8 sm:px-8">
        <ReferralLandingSection variant={isPet ? 'pet' : 'barbershop'} />
      </div>
    </div>
  )
}
