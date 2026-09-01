import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DAY_NAMES } from '../lib/types'
import { InlineError } from './EmptyState'
import { userFacingError } from '../lib/userFacingError'
import type { ServiceCustomField, ServiceCustomFieldOption, ServiceCustomFieldType, ServiceWeekdayDiscount } from '../lib/types'

interface Props { shopId: string; serviceId: string }
type OptionDraft = { label: string; price: string }

export function ServiceAdvancedSettings({ shopId, serviceId }: Props) {
  const [fields, setFields] = useState<ServiceCustomField[]>([])
  const [options, setOptions] = useState<ServiceCustomFieldOption[]>([])
  const [discounts, setDiscounts] = useState<ServiceWeekdayDiscount[]>([])
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<ServiceCustomFieldType>('single_choice')
  const [required, setRequired] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, OptionDraft>>({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: fieldData, error: fieldError }, { data: discountData, error: discountError }] = await Promise.all([
      supabase.from('service_custom_fields').select('*').eq('service_id', serviceId).order('sort_order'),
      supabase.from('service_weekday_discounts').select('*').eq('service_id', serviceId),
    ])
    if (fieldError || discountError) {
      setError(userFacingError(fieldError || discountError, 'Não foi possível carregar as configurações do serviço.'))
      return
    }
    const list = (fieldData as ServiceCustomField[]) || []
    let optionList: ServiceCustomFieldOption[] = []
    if (list.length > 0) {
      const { data, error: optionError } = await supabase.from('service_custom_field_options').select('*').in('field_id', list.map((item) => item.id)).order('sort_order')
      if (optionError) setError(userFacingError(optionError, 'Não foi possível carregar as opções.'))
      optionList = (data as ServiceCustomFieldOption[]) || []
    }
    setFields(list)
    setOptions(optionList)
    setDiscounts((discountData as ServiceWeekdayDiscount[]) || [])
  }, [serviceId])

  useEffect(() => { load() }, [load])

  const addField = async () => {
    setError('')
    if (fieldLabel.trim().length < 2) { setError('Informe o nome da pergunta.'); return }
    const { error: insertError } = await supabase.from('service_custom_fields').insert({ shop_id: shopId, service_id: serviceId, label: fieldLabel.trim(), field_type: fieldType, required, sort_order: fields.length })
    if (insertError) { setError(userFacingError(insertError, 'Não foi possível adicionar o campo.')); return }
    setFieldLabel(''); setRequired(false); await load()
  }

  const removeField = async (id: string) => {
    if (!confirm('Remover esta pergunta e suas opções?')) return
    const { error: deleteError } = await supabase.from('service_custom_fields').delete().eq('id', id)
    if (deleteError) setError(userFacingError(deleteError, 'Não foi possível remover o campo.'))
    else await load()
  }

  const addOption = async (fieldId: string) => {
    const draft = drafts[fieldId] || { label: '', price: '' }
    if (!draft.label.trim()) return
    const price = Number(draft.price.replace(',', '.') || 0)
    const { error: insertError } = await supabase.from('service_custom_field_options').insert({ shop_id: shopId, field_id: fieldId, label: draft.label.trim(), price_delta: Number.isFinite(price) && price >= 0 ? price : 0, sort_order: options.filter((item) => item.field_id === fieldId).length })
    if (insertError) setError(userFacingError(insertError, 'Não foi possível adicionar a opção.'))
    else { setDrafts((current) => ({ ...current, [fieldId]: { label: '', price: '' } })); await load() }
  }

  const removeOption = async (id: string) => {
    const { error: deleteError } = await supabase.from('service_custom_field_options').delete().eq('id', id)
    if (deleteError) setError(userFacingError(deleteError, 'Não foi possível remover a opção.'))
    else await load()
  }

  const saveDiscount = async (day: number, raw: string) => {
    const percent = Number(raw.replace(',', '.'))
    if (!raw || !Number.isFinite(percent) || percent <= 0) {
      await supabase.from('service_weekday_discounts').delete().eq('service_id', serviceId).eq('day_of_week', day)
    } else {
      const { error: upsertError } = await supabase.from('service_weekday_discounts').upsert({ shop_id: shopId, service_id: serviceId, day_of_week: day, discount_percent: Math.min(percent, 100) })
      if (upsertError) setError(userFacingError(upsertError, 'Não foi possível salvar o desconto.'))
    }
    await load()
  }

  return (
    <div className="space-y-6">
      {error && <InlineError message={error} />}
      <section>
        <h4 className="text-sm font-semibold text-white">Perguntas no agendamento</h4>
        <p className="mt-1 text-xs text-charcoal-muted">Ex.: tipo de pelo, possui nós ou alguma preferência. Opções podem acrescentar valor.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto_auto]">
          <input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="Nome da pergunta" className="min-h-11 rounded-xl border border-charcoal-light bg-charcoal px-3 text-sm text-white" />
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value as ServiceCustomFieldType)} className="min-h-11 rounded-xl border border-charcoal-light bg-charcoal px-3 text-sm text-white"><option value="single_choice">Seleção única</option><option value="text">Texto livre</option></select>
          <label className="flex min-h-11 items-center gap-2 text-sm text-charcoal-muted"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-[#d6a33d]" />Obrigatório</label>
          <button type="button" onClick={addField} className="rounded-xl bg-brass px-4 text-sm font-semibold text-charcoal">Adicionar</button>
        </div>
        <div className="mt-3 space-y-3">
          {fields.map((field) => {
            const draft = drafts[field.id] || { label: '', price: '' }
            return <div key={field.id} className="rounded-xl border border-charcoal-light bg-charcoal/40 p-3">
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-white">{field.label}</p><p className="text-xs text-charcoal-muted">{field.field_type === 'single_choice' ? 'Seleção única' : 'Texto livre'}{field.required ? ' · obrigatório' : ''}</p></div><button type="button" onClick={() => removeField(field.id)} className="text-xs text-red-300">Remover</button></div>
              {field.field_type === 'single_choice' && <div className="mt-3 space-y-2">
                {options.filter((item) => item.field_id === field.id).map((option) => <div key={option.id} className="flex items-center justify-between rounded-lg bg-charcoal-light/25 px-3 py-2 text-sm"><span className="text-white">{option.label}{Number(option.price_delta) > 0 ? ` · + R$ ${Number(option.price_delta).toFixed(2).replace('.', ',')}` : ''}</span><button type="button" onClick={() => removeOption(option.id)} className="text-xs text-red-300">Excluir</button></div>)}
                <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]"><input value={draft.label} onChange={(e) => setDrafts((current) => ({ ...current, [field.id]: { ...draft, label: e.target.value } }))} placeholder="Nome da opção" className="min-h-10 rounded-lg border border-charcoal-light bg-charcoal px-3 text-sm text-white" /><input value={draft.price} onChange={(e) => setDrafts((current) => ({ ...current, [field.id]: { ...draft, price: e.target.value } }))} placeholder="Adicional R$" inputMode="decimal" className="min-h-10 rounded-lg border border-charcoal-light bg-charcoal px-3 text-sm text-white" /><button type="button" onClick={() => addOption(field.id)} className="rounded-lg border border-brass/40 px-3 text-sm text-brass">Adicionar opção</button></div>
              </div>}
            </div>
          })}
        </div>
      </section>

      <section className="border-t border-charcoal-light pt-5"><h4 className="text-sm font-semibold text-white">Desconto por dia</h4><p className="mt-1 text-xs text-charcoal-muted">Percentual aplicado automaticamente conforme a data escolhida.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{DAY_NAMES.map((day, index) => <label key={day} className="text-xs text-charcoal-muted">{day.slice(0, 3)}<input type="number" min="0" max="100" defaultValue={discounts.find((item) => item.day_of_week === index)?.discount_percent || ''} onBlur={(e) => saveDiscount(index, e.target.value)} placeholder="0%" className="mt-1 min-h-10 w-full rounded-lg border border-charcoal-light bg-charcoal px-2 text-sm text-white" /></label>)}</div></section>
    </div>
  )
}
