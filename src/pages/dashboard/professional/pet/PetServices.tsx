import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { formatPrice, formatDuration } from '../../../../lib/format'
import { defaultSizeRules } from '../../../../lib/pet'
import { FieldHint, FieldLabel } from '../../../../components/FormHints'
import { ServiceProfessionalPicker } from '../../../../components/ServiceProfessionalPicker'
import { ServiceAdvancedSettings } from '../../../../components/ServiceAdvancedSettings'
import { AppIcon } from '../../../../components/AppIcon'
import { InlineError } from '../../../../components/EmptyState'
import { userFacingError } from '../../../../lib/userFacingError'
import { PET_SIZES, type PetSize, type Service, type ServicePetTransport, type ServiceSizeRule } from '../../../../lib/types'

interface Props {
  shopId: string
}

export function PetServices({ shopId }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [rules, setRules] = useState<ServiceSizeRule[]>([])
  const [transportSettings, setTransportSettings] = useState<ServicePetTransport[]>([])
  const [transportFee, setTransportFee] = useState('0')
  const [transportPricingMode, setTransportPricingMode] = useState<'quote' | 'fixed'>('quote')
  const [transportSaving, setTransportSaving] = useState(false)
  const [transportError, setTransportError] = useState('')
  const [transportNotice, setTransportNotice] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('60')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('services').select('*').eq('shop_id', shopId).order('name')
    const list = data || []
    setServices(list)

    if (list.length > 0) {
      const serviceIds = list.map((service) => service.id)
      const [{ data: r }, { data: transport }] = await Promise.all([
        supabase.from('service_size_rules').select('*').in('service_id', serviceIds),
        supabase.from('service_pet_transport').select('*').in('service_id', serviceIds),
      ])
      setRules((r as ServiceSizeRule[]) || [])
      const transportList = (transport as ServicePetTransport[]) || []
      setTransportSettings(transportList)
      const enabledTransport = transportList.filter((item) => item.enabled)
      const enabledFees = enabledTransport.map((item) => Number(item.fee))
      setTransportFee(String(enabledFees.length ? Math.max(...enabledFees) : 0))
      setTransportPricingMode(enabledTransport.length && enabledTransport.every((item) => item.pricing_mode === 'fixed') ? 'fixed' : 'quote')
    } else {
      setRules([])
      setTransportSettings([])
      setTransportFee('0')
      setTransportPricingMode('quote')
    }
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

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

    const enabledTransport = transportSettings.filter((item) => item.enabled)
    if (enabledTransport.length) {
      await supabase.from('service_pet_transport').upsert({
        shop_id: shopId,
        service_id: data.id,
        enabled: true,
        fee: enabledTransport[0].pricing_mode === 'quote' ? 0 : Math.max(...enabledTransport.map((item) => Number(item.fee))),
        pricing_mode: enabledTransport[0].pricing_mode,
      })
    }

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

  const saveShopTransport = async (enabled: boolean, pricingMode = transportPricingMode) => {
    setTransportError('')
    setTransportNotice('')
    if (!services.length) {
      setTransportError('Cadastre pelo menos um serviço antes de ativar o Táxi Pet.')
      return
    }
    const fee = pricingMode === 'quote' ? 0 : Number(transportFee.replace(',', '.'))
    if (!Number.isFinite(fee) || fee < 0) {
      setTransportError('Informe uma taxa válida. Use 0 se a busca for gratuita.')
      return
    }

    setTransportSaving(true)
    const { error } = await supabase.from('service_pet_transport').upsert(
      services.map((service) => ({
        shop_id: shopId,
        service_id: service.id,
        enabled,
        fee,
        pricing_mode: pricingMode,
      })),
    )
    setTransportSaving(false)
    if (error) {
      setTransportError(userFacingError(error, 'Não foi possível salvar o Táxi Pet.'))
      return
    }
    setTransportNotice(
      enabled
        ? pricingMode === 'quote'
          ? 'Táxi Pet disponível. O cliente informa o endereço e você define o valor no atendimento.'
          : 'Táxi Pet disponível para todos os serviços com a taxa fixa configurada.'
        : 'Táxi Pet desativado. A opção deixou de aparecer para novos clientes.',
    )
    await load()
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  const transportEnabled = transportSettings.some((item) => item.enabled)

  return (
    <div>
      <h2 className="font-display text-2xl text-white mb-2">Serviços de banho e tosa</h2>
      <p className="text-sm text-charcoal-muted mb-6">
        Cadastre banho, tosa e outros serviços. Defina duração e preço por porte do pet.
      </p>

      <section className="mb-8 rounded-2xl border border-brass/35 bg-gradient-to-br from-brass/10 to-transparent p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-2xl items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brass/15 text-brass">
              <AppIcon name="car" size={20} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">Serviço do estabelecimento</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Táxi Dog / Táxi Pet</h3>
              <p className="mt-1 text-sm leading-6 text-charcoal-muted">
                Informe se sua equipe busca o animal na casa do cliente. Ao ativar, a opção aparece no agendamento e a taxa entra no valor final.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={transportEnabled}
            disabled={transportSaving || !services.length}
            onClick={() => saveShopTransport(!transportEnabled)}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
              transportEnabled
                ? 'bg-brass text-charcoal'
                : 'border border-charcoal-light bg-charcoal text-charcoal-muted hover:border-brass/40 hover:text-white'
            }`}
          >
            {transportSaving ? 'Salvando...' : transportEnabled ? 'Disponível' : 'Não oferecemos'}
          </button>
        </div>

        {transportEnabled ? (
          <div className="mt-5 border-t border-charcoal-light/70 pt-4">
            <p className="text-xs font-medium text-charcoal-muted">Como o valor será definido?</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" aria-pressed={transportPricingMode === 'quote'} onClick={() => { setTransportPricingMode('quote'); saveShopTransport(true, 'quote') }} disabled={transportSaving} className={`rounded-xl border p-3 text-left transition ${transportPricingMode === 'quote' ? 'border-brass bg-brass/10' : 'border-charcoal-light bg-charcoal/40'}`}>
                <span className="block text-sm font-semibold text-white">Conforme o endereço</span>
                <span className="mt-1 block text-xs leading-5 text-charcoal-muted">O cliente informa onde mora e o valor é preenchido ao finalizar o atendimento.</span>
              </button>
              <button type="button" aria-pressed={transportPricingMode === 'fixed'} onClick={() => { setTransportPricingMode('fixed'); saveShopTransport(true, 'fixed') }} disabled={transportSaving} className={`rounded-xl border p-3 text-left transition ${transportPricingMode === 'fixed' ? 'border-brass bg-brass/10' : 'border-charcoal-light bg-charcoal/40'}`}>
                <span className="block text-sm font-semibold text-white">Taxa fixa</span>
                <span className="mt-1 block text-xs leading-5 text-charcoal-muted">O mesmo valor é informado e somado automaticamente em todos os agendamentos.</span>
              </button>
            </div>
            {transportPricingMode === 'fixed' ? (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="w-full max-w-xs text-xs font-medium text-charcoal-muted">
                  Taxa cobrada por agendamento
                  <input value={transportFee} onChange={(event) => setTransportFee(event.target.value)} inputMode="decimal" placeholder="Ex: 15,00" className="mt-1.5 min-h-11 w-full rounded-xl border border-charcoal-light bg-charcoal px-3 text-sm text-white outline-none focus:border-brass" />
                </label>
                <button type="button" onClick={() => saveShopTransport(true, 'fixed')} disabled={transportSaving} className="min-h-11 rounded-xl border border-brass/40 px-4 text-sm font-semibold text-brass transition hover:bg-brass/10 disabled:opacity-50">Salvar taxa fixa</button>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-charcoal/40 px-4 py-3 text-sm leading-6 text-charcoal-muted">
                Na confirmação, o cliente verá “valor a confirmar”. O endereço ficará destacado na agenda para você calcular a rota.
              </p>
            )}
          </div>
        ) : null}
        {transportError ? <div className="mt-4"><InlineError message={transportError} /></div> : null}
        {transportNotice ? <p role="status" className="mt-4 rounded-xl border border-brass/20 bg-charcoal/35 px-4 py-3 text-sm text-brass-light">{transportNotice}</p> : null}
        {!services.length ? <p className="mt-4 text-xs text-charcoal-muted">Cadastre o primeiro serviço para liberar esta configuração.</p> : null}
      </section>

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
                    {editingId === s.id ? 'Fechar' : 'Configurar serviço'}
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
                <div className="mt-4 space-y-5 border-t border-charcoal-light pt-4">
                  <div>
                    <ServiceProfessionalPicker shopId={shopId} serviceId={s.id} />
                  </div>

                  <div className="border-t border-charcoal-light pt-5">
                    <ServiceAdvancedSettings shopId={shopId} serviceId={s.id} />
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-semibold text-white">Preço e duração por porte</p>
                    <div className="grid gap-3 sm:grid-cols-3">
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
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
