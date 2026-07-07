import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/format'
import type { Shop, Service } from '../../lib/types'
import { BarberPole } from '../../components/BarberPole'

interface ShopWithServices extends Shop {
  services: Service[]
}

export function ShopList() {
  const [shops, setShops] = useState<ShopWithServices[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: shopsData } = await supabase
        .from('shops')
        .select('*')
        .neq('subscription_status', 'blocked')
        .order('name')

      if (!shopsData) {
        setLoading(false)
        return
      }

      const withServices = await Promise.all(
        shopsData.map(async (shop) => {
          const { data: services } = await supabase
            .from('services')
            .select('*')
            .eq('shop_id', shop.id)
            .limit(3)
          return { ...shop, services: services || [] }
        })
      )

      setShops(withServices)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <p className="text-center text-ink-muted">Carregando barbearias...</p>
  }

  return (
    <div>
      <div className="mb-10 text-center">
        <h1 className="font-display text-5xl text-ink mb-2">Encontre sua barbearia</h1>
        <BarberPole className="mx-auto max-w-xs mb-4" />
        <p className="text-ink-muted">Agende online, sem fila, com estilo clássico.</p>
      </div>

      {shops.length === 0 ? (
        <p className="text-center text-ink-muted py-12">
          Nenhuma barbearia disponível no momento.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {shops.map((shop) => (
            <Link
              key={shop.id}
              to={`/barbearia/${shop.id}`}
              className="group rounded-lg border border-paper-dark bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <h2 className="font-display text-2xl text-ink group-hover:text-brass transition-colors">
                {shop.name}
              </h2>
              {shop.slogan && (
                <p className="text-sm text-ink-muted italic mt-1">{shop.slogan}</p>
              )}
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
          ))}
        </div>
      )}
    </div>
  )
}
