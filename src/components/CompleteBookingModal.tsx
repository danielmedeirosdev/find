import { Modal } from './Modal'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { customerLabel, formatPrice } from '../lib/format'
import { applyWeekdayDiscount } from '../lib/servicePricing'
import { getPetServicesPrice } from '../lib/pet'
import { amountDue, selectedBookingTotal } from '../lib/finance'
import { packageRemaining } from '../lib/notifications'
import { userFacingError } from '../lib/userFacingError'
import type { BookingWithDetails, CustomerPackage, PaymentMethod, Service, ServiceSizeRule, ServiceWeekdayDiscount } from '../lib/types'

interface Props {
  booking: BookingWithDetails
  shopServices: Service[]
  onClose: () => void
  onComplete: () => void
}

export function CompleteBookingModal({ booking, shopServices, onClose, onComplete }: Props) {
  const initialIds = useMemo(
    () => new Set<string>((booking.booking_services || []).map((bs) => bs.service_id)),
    [booking]
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialIds)
  const [paidNow,setPaidNow] = useState(true)
  const [rules,setRules] = useState<ServiceSizeRule[]>([])
  const [discounts,setDiscounts] = useState<ServiceWeekdayDiscount[]>([])
  const [pricesReady,setPricesReady] = useState(false)
  const [packagesReady,setPackagesReady] = useState(!booking.pet_id)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [packages, setPackages] = useState<CustomerPackage[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [transportFee, setTransportFee] = useState(String(Number(booking.pet_transport_fee || 0).toFixed(2)).replace('.', ','))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active=true;
    Promise.all([
      supabase.from('service_size_rules').select('*').in('service_id',shopServices.map(s=>s.id)),
      supabase.from('service_weekday_discounts').select('*').in('service_id',shopServices.map(s=>s.id))
    ]).then(([r,d])=>{if(!active)return;if(r.error||d.error){setError('Não foi possível conferir os preços. Reabra o atendimento.');return}setRules(r.data||[]);setDiscounts(d.data||[]);setPricesReady(true)})
    return ()=>{active=false}
  },[shopServices])
  useEffect(() => {
    if (!booking.pet_id) return
    supabase.rpc('completion_packages', {p_booking_id:booking.id})
      .then(({ data, error: packageError }) => {
        if(packageError){setError("Não foi possível conferir os pacotes. Reabra o atendimento.");setPackagesReady(false);return}
        const list = ((data as CustomerPackage[]) || []).filter(
          (p) => packageRemaining(p.total_sessions, p.used_sessions) > 0 && (!p.expires_at || p.expires_at >= new Date().toLocaleDateString('en-CA'))
        )
        setPackagesReady(true)
        setPackages(list)
        if (list.length === 1) setSelectedPackageId(list[0].id)
      })
  }, [booking.id,booking.pet_id])

  const selectedServices = shopServices.filter((s) => selectedIds.has(s.id))
  const parsedTransportFee = Number(transportFee.replace(',', '.'))
  const pricedServices=shopServices.map(s=>({...s,price:Math.round(applyWeekdayDiscount(getPetServicesPrice([s],booking.pets?.size||'medio',rules),s.id,booking.date,discounts)*100)/100}))
  const quotedTotal = selectedBookingTotal(booking, selectedIds, pricedServices, booking.pet_transport_requested && Number.isFinite(parsedTransportFee) ? parsedTransportFee : 0)
  const total = amountDue(quotedTotal,Number(booking.services_amount ?? booking.booking_services?.reduce((sum,s)=>sum+Number(s.services.price),0) ?? 0),Boolean(selectedPackageId))

  const toggleService = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = async () => {
    if (submitting || !pricesReady || !packagesReady) return
    if (selectedServices.length === 0) {
      setError('Selecione ao menos um serviço.')
      return
    }
    if (booking.pet_transport_requested && (!Number.isFinite(parsedTransportFee) || parsedTransportFee < 0)) {
      setError('Informe um valor válido para o Táxi Pet.')
      return
    }

    setSubmitting(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('complete_booking_payment', {
      p_booking_id: booking.id,
      p_paid_now: paidNow, p_transport_fee: booking.pet_transport_requested ? parsedTransportFee : null, p_reserved_minutes: booking.duration_minutes || null,
      p_service_ids: selectedServices.map((s) => s.id),
      p_payment_method: paymentMethod,
      p_amount: total,
      p_customer_package_id: selectedPackageId || null,
    })

    if (rpcError) {
      setError(userFacingError(rpcError, 'Não foi possível finalizar o atendimento.'))
      setSubmitting(false)
      return
    }

    onComplete()
  }

  return (
    <Modal label="Finalizar atendimento" onClose={onClose} busy={submitting} className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border border-charcoal-light bg-charcoal p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl sm:p-6">
        <h3 className="font-display text-xl font-semibold text-white mb-1">Finalizar atendimento</h3>
        <p className="text-sm text-charcoal-muted mb-4">
          {booking.pets?.name ? `${booking.pets.name} · ` : ''}
          {customerLabel({name:booking.shop_customers?.name ?? booking.client_name,phone:booking.client_phone})} · {booking.barbers?.name}
        </p>

        <div className="mb-5">
          <p className="text-sm font-medium text-white mb-3">Serviços executados</p>
          <div className="space-y-2">
            {shopServices.filter(s => s.is_active !== false || initialIds.has(s.id)).map((s) => (
              <label
                key={s.id}
                className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${
                  selectedIds.has(s.id) ? 'border-brass bg-brass/10' : 'border-charcoal-light'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    disabled={initialIds.has(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="accent-brass"
                  />
                  <span className="min-w-0 break-words text-sm text-white">{s.name}</span>
                </div>
                <span className="shrink-0 text-right text-xs font-medium tabular-nums text-brass sm:text-sm">{formatPrice(Number(pricedServices.find(item=>item.id===s.id)?.price ?? s.price))}</span>
              </label>
            ))}
          </div>

        </div>

        {(booking.booking_custom_field_answers?.length || booking.pet_transport_requested) ? (
          <div className="mb-6 rounded-xl border border-charcoal-light bg-charcoal-light/20 p-4">
            <p className="mb-2 text-sm font-medium text-white">Detalhes combinados</p>
            {booking.booking_custom_field_answers?.map((answer) => <p key={answer.id} className="text-sm text-charcoal-muted"><span className="text-white">{answer.field_label}:</span> {answer.answer}{Number(answer.price_delta) > 0 ? ` · + ${formatPrice(Number(answer.price_delta))}` : ''}</p>)}
            {booking.pet_transport_requested && <div className="mt-3 border-t border-charcoal-light pt-3 text-sm"><p className="font-medium text-brass">Táxi Dog / Táxi Pet — buscar em casa</p><p className="mt-1 text-white">{booking.pet_transport_address}</p>{booking.pet_transport_notes && <p className="mt-1 text-charcoal-muted">{booking.pet_transport_notes}</p>}<label className="mt-4 block font-medium text-white">Valor do transporte (R$)<input type="text" inputMode="decimal" value={transportFee} onChange={(event) => setTransportFee(event.target.value.replace(/[^0-9,.]/g, ''))} placeholder="0,00" className="mt-1.5 min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 text-white outline-none focus:border-brass" /></label></div>}
          </div>
        ) : null}

        {packages.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-white mb-2">Usar sessão de pacote</p>
            <select
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white"
            >
              <option value="">Não debitar</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.service_packages?.name || 'Pacote'} ·{' '}
                  {packageRemaining(p.total_sessions, p.used_sessions)} restantes
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedPackageId && <p className="mb-4 text-sm text-brass">Usa 1 sessão. Novos extras e transporte são cobrados à parte.</p>}
        <div className="mb-4 grid grid-cols-2 gap-2">{[[true,'Pago agora'],[false,'Pagar depois']].map(([value,label])=><button key={String(value)} type="button" onClick={()=>setPaidNow(value===true)} className={`min-h-12 rounded-lg border p-2 text-sm ${paidNow===(value===true)?'border-brass text-brass':'border-charcoal-light text-white'}`}>{label}</button>)}</div>
        {!paidNow && <p className="mb-4 text-sm text-charcoal-muted">Valor pendente, sem entrada no caixa.</p>}
        <div className={paidNow ? "mb-6" : "hidden"}>
          <p className="text-sm font-medium text-white mb-3">Forma de pagamento</p>
          <div className="grid grid-cols-3 gap-2">
            {(['pix', 'cartao', 'dinheiro'] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  paymentMethod === method
                    ? 'border-brass bg-brass/10 text-brass'
                    : 'border-charcoal-light text-charcoal-muted hover:border-brass/50'
                }`}
              >
                {method === 'pix' ? 'Pix' : method === 'cartao' ? 'Cartão' : 'Dinheiro'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-brass/25 bg-brass/10 p-4">
          <span className="text-white">{paidNow ? 'Receber agora' : 'Ficará pendente'}</span>
          <span className="break-all text-right text-lg font-semibold tabular-nums text-brass">{formatPrice(total)}</span>
        </div>

        {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            disabled={submitting || !pricesReady || !packagesReady}
            className="min-h-12 rounded-xl border border-charcoal-light px-2 py-3 text-sm text-charcoal-muted hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !pricesReady || !packagesReady}
            className="min-h-12 rounded-xl bg-brass px-2 py-3 text-sm font-semibold text-charcoal disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
