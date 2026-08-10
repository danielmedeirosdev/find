import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatPrice } from '../lib/format'
import { getTotalPrice } from '../lib/booking'
import { packageRemaining } from '../lib/notifications'
import { notifyCustomerWhatsApp } from '../lib/notifications'
import { guestReviewUrl } from '../lib/reviews'
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
  const total = getTotalPrice(selectedServices)

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

    setSubmitting(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('complete_booking', {
      p_booking_id: booking.id,
      p_service_ids: selectedServices.map((s) => s.id),
      p_payment_method: paymentMethod,
      p_amount: total,
      p_customer_package_id: selectedPackageId || null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    await notifyCustomerWhatsApp({
      toPhone: booking.client_phone,
      kind: 'review_request',
      body: `Olá ${booking.client_name}! Seu atendimento foi concluído. Avalie aqui: ${guestReviewUrl(booking.id)}`,
      shopId: booking.shop_id,
      bookingId: booking.id,
    })

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
                  {p.service_packages?.name || 'Pacote'} —{' '}
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
