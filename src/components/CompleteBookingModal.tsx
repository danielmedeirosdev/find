import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatPrice } from '../lib/format'
import { getTotalPrice } from '../lib/booking'
import { packageRemaining } from '../lib/notifications'
import { userFacingError } from '../lib/userFacingError'
import type { BookingWithDetails, CustomerPackage, PaymentMethod, Service } from '../lib/types'

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [packages, setPackages] = useState<CustomerPackage[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [transportFee, setTransportFee] = useState(String(Number(booking.pet_transport_fee || 0).toFixed(2)).replace('.', ','))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!booking.pet_id) return
    supabase
      .from('customer_packages')
      .select('*, service_packages(*)')
      .eq('pet_id', booking.pet_id)
      .eq('status', 'active')
      .then(({ data }) => {
        const list = ((data as CustomerPackage[]) || []).filter(
          (p) => packageRemaining(p.total_sessions, p.used_sessions) > 0
        )
        setPackages(list)
      })
  }, [booking.pet_id])

  const selectedServices = shopServices.filter((s) => selectedIds.has(s.id))
  const selectionUnchanged = selectedIds.size === initialIds.size && Array.from(selectedIds).every((id) => initialIds.has(id))
  const parsedTransportFee = Number(transportFee.replace(',', '.'))
  const currentTransportFee = Number(booking.pet_transport_fee || 0)
  const baseTotal = selectionUnchanged && booking.quoted_amount != null
    ? Math.max(0, Number(booking.quoted_amount) - currentTransportFee)
    : getTotalPrice(selectedServices) + Number(booking.extras_amount || 0)
  const total = baseTotal + (booking.pet_transport_requested && Number.isFinite(parsedTransportFee) ? parsedTransportFee : 0)

  const toggleService = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = async () => {
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

    if (booking.pet_transport_requested) {
      const { error: transportError } = await supabase.rpc('set_pet_transport_fee', {
        p_booking_id: booking.id,
        p_fee: parsedTransportFee,
      })

      if (transportError) {
        setError(userFacingError(transportError, 'Não foi possível salvar o valor do Táxi Pet.'))
        setSubmitting(false)
        return
      }
    }

    const { error: rpcError } = await supabase.rpc('complete_booking', {
      p_booking_id: booking.id,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-charcoal-light bg-charcoal p-6">
        <h3 className="font-display text-xl text-white mb-1">Finalizar atendimento</h3>
        <p className="text-sm text-charcoal-muted mb-6">
          {booking.pets?.name ? `${booking.pets.name} · ` : ''}
          {booking.client_name} · {booking.barbers?.name}
        </p>

        <div className="mb-6">
          <p className="text-sm font-medium text-white mb-3">Serviços executados</p>
          <div className="space-y-2">
            {shopServices.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${
                  selectedIds.has(s.id) ? 'border-brass bg-brass/10' : 'border-charcoal-light'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="accent-brass"
                  />
                  <span className="text-sm text-white">{s.name}</span>
                </div>
                <span className="font-mono text-sm text-brass">{formatPrice(Number(s.price))}</span>
              </label>
            ))}
          </div>
        </div>

        {(booking.booking_custom_field_answers?.length || booking.pet_transport_requested) ? (
          <div className="mb-6 rounded-xl border border-charcoal-light bg-charcoal-light/20 p-4">
            <p className="mb-2 text-sm font-medium text-white">Detalhes combinados</p>
            {booking.booking_custom_field_answers?.map((answer) => <p key={answer.id} className="text-sm text-charcoal-muted"><span className="text-white">{answer.field_label}:</span> {answer.answer}{Number(answer.price_delta) > 0 ? ` · + ${formatPrice(Number(answer.price_delta))}` : ''}</p>)}
            {booking.pet_transport_requested && <div className="mt-3 border-t border-charcoal-light pt-3 text-sm"><p className="font-medium text-brass">Táxi Dog / Táxi Pet — buscar em casa</p><p className="mt-1 text-white">{booking.pet_transport_address}</p>{booking.pet_transport_notes && <p className="mt-1 text-charcoal-muted">{booking.pet_transport_notes}</p>}<label className="mt-4 block font-medium text-white">Valor do transporte (R$)<input type="text" inputMode="decimal" value={transportFee} onChange={(event) => setTransportFee(event.target.value.replace(/[^0-9,.]/g, ''))} placeholder="0,00" className="mt-1.5 min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 text-white outline-none focus:border-brass" /></label><p className="mt-1 text-xs text-charcoal-muted">Confirme o valor da rota. Ele será somado ao total e registrado no financeiro.</p></div>}
          </div>
        ) : null}

        {packages.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-white mb-2">Debitar pacote (opcional)</p>
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

        <div className="mb-6">
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

        <div className="mb-6 flex justify-between rounded-lg bg-charcoal-light/30 p-4 font-mono">
          <span className="text-white">Total</span>
          <span className="text-brass text-lg">{formatPrice(total)}</span>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-charcoal-light py-3 text-charcoal-muted hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 rounded-lg bg-brass py-3 font-semibold text-charcoal disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
