import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { formatPrice, formatDuration } from '../../../../lib/format'
import { defaultSizeRules } from '../../../../lib/pet'
import { FieldHint, FieldLabel } from '../../../../components/FormHints'
import { PET_SIZES, type PetSize, type Service, type ServiceSizeRule } from '../../../../lib/types'

interface Props {
  shopId: string
}

export function PetServices({ shopId }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [rules, setRules] = useState<ServiceSizeRule[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('60')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')
    const list = data || []
    setServices(list)

    if (list.length > 0) {
      const { data: r } = await supabase
        .from('service_size_rules')
        .select('*')
        .in(
          'service_id',
          list.map((s) => s.id)
        )
      setRules((r as ServiceSizeRule[]) || [])
    } else {
      setRules([])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [shopId])

  const addService = async () => {
    if (!name.trim() || !price) return
    const basePrice = parseFloat(price.replace(',', '.'))
    const baseDuration = parseInt(duration, 10) || 60
    const { data, error } = await supabase
      .from('services')
      .insert({
        shop_id: shopId,
        name: name.trim(),
        price: basePrice,
        duration_minutes: baseDuration,
      })
      .select('*')
      .single()

    if (error || !data) return

    await supabase.from('service_size_rules').insert(defaultSizeRules(data.id, baseDuration, basePrice))

    setName('')
    setPrice('')
    setDuration('60')
    load()
  }

  const removeService = async (id: string) => {
    if (!confirm('Remover este serviço?')) return
    await supabase.from('services').delete().eq('id', id)
    load()
  }

  const updateRule = async (
    serviceId: string,
    size: PetSize,
    field: 'duration_minutes' | 'price',
    value: string
  ) => {
    const num = parseFloat(value.replace(',', '.'))
    if (isNaN(num) || num <= 0) return
    const existing = rules.find((r) => r.service_id === serviceId && r.size === size)
    if (existing) {
      await supabase
        .from('service_size_rules')
        .update({ [field]: num })
        .eq('id', existing.id)
    } else {
      await supabase.from('service_size_rules').insert({
        service_id: serviceId,
        size,
        duration_minutes: field === 'duration_minutes' ? num : 60,
        price: field === 'price' ? num : null,
      })
    }
    load()
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  return (
    <div>
      <h2 className="font-display text-2xl text-white mb-2">Serviços de banho e tosa</h2>
      <p className="text-sm text-charcoal-muted mb-6">
        Cadastre banho, tosa e outros serviços. Defina duração e preço por porte do pet.
      </p>

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <div>
          <FieldLabel>Nome do serviço</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Banho + Tosa"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
        </div>
        <div>
          <FieldLabel>Preço base</FieldLabel>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ex: 80,00"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 font-mono text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
          <FieldHint>Usado como base; ajuste por porte abaixo.</FieldHint>
        </div>
        <div>
          <FieldLabel>Duração base (min)</FieldLabel>
          <input
            type="number"
            min="15"
            step="15"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Ex: 60"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 font-mono text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={addService}
            className="w-full rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal"
          >
            Adicionar
          </button>
        </div>
      </div>

      {services.length === 0 ? (
        <p className="text-charcoal-muted">Nenhum serviço cadastrado ainda.</p>
      ) : (
        <div className="space-y-4">
          {services.map((s) => (
            <div key={s.id} className="rounded-lg border border-charcoal-light p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-white">{s.name}</span>
                  <span className="ml-4 font-mono text-sm text-brass">
                    {formatPrice(Number(s.price))}
                  </span>
                  <span className="ml-2 font-mono text-sm text-charcoal-muted">
                    {formatDuration(s.duration_minutes)}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                    className="text-sm text-brass"
                  >
                    {editingId === s.id ? 'Fechar' : 'Duração por porte'}
                  </button>
                  <button
                    onClick={() => removeService(s.id)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remover
                  </button>
                </div>
              </div>

              {editingId === s.id && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {PET_SIZES.map(({ value, label }) => {
                    const rule = rules.find((r) => r.service_id === s.id && r.size === value)
                    return (
                      <div key={value} className="rounded bg-charcoal-light/30 p-3 space-y-2">
                        <p className="text-sm text-brass font-medium">{label}</p>
                        <label className="block text-xs text-charcoal-muted">
                          Minutos
                          <input
                            type="number"
                            min="15"
                            step="15"
                            defaultValue={rule?.duration_minutes ?? s.duration_minutes}
                            onBlur={(e) =>
                              updateRule(s.id, value, 'duration_minutes', e.target.value)
                            }
                            className="mt-1 w-full rounded border border-charcoal-light bg-charcoal px-2 py-1 font-mono text-sm text-white"
                          />
                        </label>
                        <label className="block text-xs text-charcoal-muted">
                          Preço (opcional)
                          <input
                            type="text"
                            defaultValue={rule?.price ?? s.price}
                            onBlur={(e) => updateRule(s.id, value, 'price', e.target.value)}
                            className="mt-1 w-full rounded border border-charcoal-light bg-charcoal px-2 py-1 font-mono text-sm text-white"
                          />
                        </label>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
