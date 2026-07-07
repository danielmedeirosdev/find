import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice, formatDuration } from '../../../lib/format'
import type { Service } from '../../../lib/types'

interface Props {
  shopId: string
}

export function ServicesTab({ shopId }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('30')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')
    setServices(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [shopId])

  const addService = async () => {
    if (!name.trim() || !price) return
    await supabase.from('services').insert({
      shop_id: shopId,
      name: name.trim(),
      price: parseFloat(price),
      duration_minutes: parseInt(duration, 10),
    })
    setName('')
    setPrice('')
    setDuration('30')
    load()
  }

  const removeService = async (id: string) => {
    if (!confirm('Remover este serviço?')) return
    await supabase.from('services').delete().eq('id', id)
    load()
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  return (
    <div>
      <h2 className="font-display text-2xl text-white mb-6">Serviços e preços</h2>

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do serviço"
          className="rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preço (R$)"
          className="rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 font-mono text-white focus:border-brass focus:outline-none"
        />
        <input
          type="number"
          min="5"
          step="5"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Duração (min)"
          className="rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 font-mono text-white focus:border-brass focus:outline-none"
        />
        <button
          onClick={addService}
          className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal"
        >
          Adicionar
        </button>
      </div>

      {services.length === 0 ? (
        <p className="text-charcoal-muted">Nenhum serviço cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-charcoal-light p-4"
            >
              <div>
                <span className="font-medium text-white">{s.name}</span>
                <span className="ml-4 font-mono text-sm text-brass">
                  {formatPrice(Number(s.price))}
                </span>
                <span className="ml-2 font-mono text-sm text-charcoal-muted">
                  {formatDuration(s.duration_minutes)}
                </span>
              </div>
              <button
                onClick={() => removeService(s.id)}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
