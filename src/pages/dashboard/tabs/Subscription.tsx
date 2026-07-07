import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice, subscriptionLabel } from '../../../lib/format'
import { SUBSCRIPTION_PRICE, type Shop, type BillingType, type SubscribeHandler } from '../../../lib/types'
import { BarberPole } from '../../../components/BarberPole'

interface Props {
  shop: Shop
  onUpdate: () => void
  onSubscribe: SubscribeHandler
  subscribing: boolean
  subscribeError?: string
}

export function SubscriptionTab({ shop, onUpdate, onSubscribe, subscribing, subscribeError }: Props) {
  const [cpfCnpj, setCpfCnpj] = useState(shop.cpf_cnpj || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [billingType, setBillingType] = useState<BillingType>('PIX')

  const saveCpfCnpj = async () => {
    const cleaned = cpfCnpj.replace(/\D/g, '')
    if (cleaned.length !== 11 && cleaned.length !== 14) {
      setMessage('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.')
      return
    }
    setSaving(true)
    setMessage('')
    const { error } = await supabase
      .from('shops')
      .update({ cpf_cnpj: cleaned })
      .eq('id', shop.id)
    if (error) setMessage(error.message)
    else {
      setMessage('CPF/CNPJ salvo!')
      onUpdate()
    }
    setSaving(false)
  }

  const statusColor =
    shop.subscription_status === 'active'
      ? 'text-green-400'
      : shop.subscription_status === 'blocked'
        ? 'text-red-400'
        : 'text-yellow-400'

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-2xl text-white mb-6">Assinatura</h2>

      <div className="rounded-lg border border-charcoal-light p-6 mb-6">
        <BarberPole className="mb-4" />
        <p className="text-charcoal-muted text-sm mb-1">Plano FIND</p>
        <p className="font-mono text-3xl text-brass mb-4">
          {formatPrice(SUBSCRIPTION_PRICE)}<span className="text-lg text-charcoal-muted">/mês</span>
        </p>
        <p className="text-sm">
          Status:{' '}
          <span className={`font-semibold ${statusColor}`}>
            {subscriptionLabel(shop.subscription_status)}
          </span>
        </p>
        <p className="text-sm text-charcoal-muted mt-2">
          Pagamento recorrente via Pix ou cartão (Asaas).
        </p>
      </div>

      <div className="rounded-lg border border-charcoal-light p-6 mb-6 space-y-4">
        <h3 className="font-medium text-white">CPF ou CNPJ (obrigatório para assinar)</h3>
        <input
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
        />
        <button
          onClick={saveCpfCnpj}
          disabled={saving}
          className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:text-white hover:border-brass transition-colors disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar CPF/CNPJ'}
        </button>
        {message && (
          <p className={`text-sm ${message.includes('salvo') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}
      </div>

      {shop.subscription_status !== 'active' && (
        <>
          <div className="mb-4">
            <h3 className="font-medium text-white mb-3">Forma de pagamento</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillingType('PIX')}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  billingType === 'PIX'
                    ? 'border-brass bg-brass/10 text-brass'
                    : 'border-charcoal-light text-charcoal-muted hover:border-brass/50'
                }`}
              >
                Pix
              </button>
              <button
                type="button"
                onClick={() => setBillingType('CREDIT_CARD')}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  billingType === 'CREDIT_CARD'
                    ? 'border-brass bg-brass/10 text-brass'
                    : 'border-charcoal-light text-charcoal-muted hover:border-brass/50'
                }`}
              >
                Cartão
              </button>
            </div>
          </div>

          <button
            onClick={() => onSubscribe(billingType)}
            disabled={subscribing || !shop.cpf_cnpj}
            className="w-full rounded-lg bg-brass py-3 font-semibold text-charcoal disabled:opacity-50"
          >
            {subscribing ? 'Gerando link...' : `Assinar com ${billingType === 'PIX' ? 'Pix' : 'cartão'}`}
          </button>
        </>
      )}

      {subscribeError && (
        <p className="mt-3 text-sm text-red-400 text-center">{subscribeError}</p>
      )}

      {!shop.cpf_cnpj && (
        <p className="mt-2 text-sm text-charcoal-muted text-center">
          Salve seu CPF/CNPJ antes de assinar.
        </p>
      )}
    </div>
  )
}
