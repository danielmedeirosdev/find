import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice, formatDuration } from '../../../lib/format'
import { FieldHint, FieldLabel } from '../../../components/FormHints'
import { ServiceProfessionalPicker } from '../../../components/ServiceProfessionalPicker'
import { ServiceAdvancedSettings } from '../../../components/ServiceAdvancedSettings'
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
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')
    setServices(data || [])
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  const addService = async () => {
    if (!name.trim() || !price) return
    const basePrice = parseFloat(price.replace(',', '.'))
    const baseDuration = parseInt(duration, 10) || 30
    const { error } = await supabase.from('services').insert({
      shop_id: shopId,
      name: name.trim(),
      price: basePrice,
      duration_minutes: baseDuration,
    })

    if (error) return

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
      <h2 className="font-display text-2xl text-white mb-2">Serviços e preços</h2>
      <p className="text-sm text-charcoal-muted mb-6">
        Cadastre todos os serviços que podem ser agendados pelos clientes.
      </p>

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <div>
          <FieldLabel>Nome do serviço</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Corte masculino"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
        </div>
        <div>
          <FieldLabel>Preço</FieldLabel>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ex: 45,00"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 font-mono text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
          <FieldHint>Informe apenas números. Ex: 45,00</FieldHint>
        </div>
        <div>
          <FieldLabel>Duração (min)</FieldLabel>
          <input
            type="number"
            min="15"
            step="15"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Ex: 30"
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
            <div key={s.id} className="rounded-2xl border border-charcoal-light bg-charcoal-dark/30 p-4">
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
                  <button type="button" onClick={() => setEditingId(editingId === s.id ? null : s.id)} className="text-sm text-brass">
                    {editingId === s.id ? 'Fechar' : 'Configurar serviço'}
                  </button>
                  <button onClick={() => removeService(s.id)} className="text-sm text-red-400 hover:text-red-300">Remover</button>
                </div>
              </div>
              {editingId === s.id && (
                <div className="mt-4 space-y-5 border-t border-charcoal-light pt-4">
                  <ServiceProfessionalPicker shopId={shopId} serviceId={s.id} />
                  <ServiceAdvancedSettings shopId={shopId} serviceId={s.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
