import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/format'
import { DefaultAvatar, Skeleton } from '../../components/MediaUI'
import { BarberPole } from '../../components/BarberPole'
import type { Barber, Service, Shop, ShopPhoto } from '../../lib/types'

export function ShopPublic() {
  const { slug } = useParams<{ slug: string }>()
  const [shop, setShop] = useState<Shop | null>(null)
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
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

      const [{ data: ph }, { data: barb }, { data: svc }] = await Promise.all([
        supabase
          .from('shop_photos')
          .select('*')
          .eq('shop_id', shopData.id)
          .order('sort_order'),
        supabase.from('barbers').select('*').eq('shop_id', shopData.id).order('name'),
        supabase.from('services').select('*').eq('shop_id', shopData.id).order('name'),
      ])

      setShop(shopData)
      setPhotos((ph as ShopPhoto[]) || [])
      setBarbers(barb || [])
      setServices(svc || [])
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (!shop) {
    return <p className="text-center text-ink-muted">Barbearia não encontrada.</p>
  }

  const hero = photos[0]?.url || shop.banner_url || shop.logo_url

  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-xl bg-paper-dark">
        {hero ? (
          <img
            src={hero}
            alt=""
            className="max-h-[28rem] min-h-[16rem] w-full object-cover object-center sm:min-h-[20rem]"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            sizes="(max-width: 768px) 100vw, 960px"
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-paper-dark">
            <BarberPole className="max-w-xs" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
          {shop.logo_url && (
            <img
              src={shop.logo_url}
              alt={shop.name}
              className="h-16 w-16 shrink-0 rounded-xl border-2 border-white object-cover shadow"
            />
          )}
          <div className="text-white drop-shadow-md">
            <h1 className="font-display text-3xl sm:text-4xl">{shop.name}</h1>
            {shop.slogan && <p className="text-sm italic opacity-95">{shop.slogan}</p>}
          </div>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          to={`/barbearia/${shop.id}`}
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

      {(shop.address || shop.hours_text || shop.phone) && (
        <div className="mb-10 rounded-lg border border-paper-dark bg-white p-5 text-sm text-ink-muted space-y-1">
          {shop.address && <p>{shop.address}</p>}
          {shop.hours_text && <p className="font-mono">{shop.hours_text}</p>}
          {shop.phone && <p>{shop.phone}</p>}
        </div>
      )}

      {photos.length > 1 && (
        <section className="mb-10">
          <h2 className="font-display text-2xl text-ink mb-4">Ambiente</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <img
                key={p.id}
                src={p.url}
                alt=""
                loading="lazy"
                className="aspect-square rounded-lg object-cover transition-transform hover:scale-[1.02]"
              />
            ))}
          </div>
        </section>
      )}

      {barbers.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-2xl text-ink mb-4">Equipe</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {barbers.map((b) => (
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
                <div>
                  <p className="font-medium text-ink">{b.name}</p>
                  {b.role && <p className="text-sm text-ink-muted">{b.role}</p>}
                </div>
              </div>
            ))}
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
            to={`/barbearia/${shop.id}`}
            className="mt-6 inline-block rounded-lg bg-brass px-6 py-3 font-semibold text-charcoal"
          >
            Agendar agora
          </Link>
        </section>
      )}
    </div>
  )
}
