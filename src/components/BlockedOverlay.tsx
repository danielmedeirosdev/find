import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandAccent } from './BrandAccent'
import { DeleteShopControl } from './DeleteShopControl'
import { formatPrice, subscriptionLabel } from '../lib/format'
import { getSegment } from '../lib/segments'
import { SUBSCRIPTION_PRICE, type BillingType, type ShopSegment, type SubscribeHandler } from '../lib/types'

type BlockReason = 'trial_expired' | 'payment_overdue'

interface BlockedOverlayProps {
  shopName: string
  segment?: ShopSegment | string | null
  blockReason?: BlockReason
  onSubscribe: SubscribeHandler
  loading?: boolean
  error?: string
}

export function BlockedOverlay({
  shopName,
  segment,
  blockReason = 'payment_overdue',
  onSubscribe,
  loading,
  error,
}: BlockedOverlayProps) {
  const [billingType, setBillingType] = useState<BillingType>('PIX')
  const isTrialExpired = blockReason === 'trial_expired'
  const seg = getSegment(segment)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <BrandAccent className="mb-6 max-w-md" height="h-2" segment={seg.id} />
      <h2 className="font-display text-4xl text-brass mb-2">
        {isTrialExpired ? 'Período de teste encerrado' : 'Assinatura pendente'}
      </h2>
      <p className="max-w-md text-charcoal-muted mb-2">
        {isTrialExpired ? (
          <>
            O período de teste de <strong className="text-white">{shopName}</strong> chegou ao fim.
            Assine o FIND para continuar recebendo agendamentos online.
          </>
        ) : (
          <>
            {seg.blockedBody} <strong className="text-white">{shopName}</strong> está temporariamente
            bloqueado{seg.id === 'pet' ? '' : 'a'} por falta de pagamento.
          </>
        )}
      </p>
      <p className="max-w-md text-charcoal-muted mb-6">
        Status: <span className="text-red-400">{subscriptionLabel('blocked')}</span>.
        {isTrialExpired
          ? ` Escolha um plano para reativar ${seg.deleteArticle === 'a' ? 'sua' : 'seu'} ${seg.deleteConfirmVerb}.`
          : ' Regularize o pagamento para voltar a receber agendamentos online.'}
      </p>
      <p className="font-mono text-brass text-lg mb-6">
        {formatPrice(SUBSCRIPTION_PRICE)}/mês
      </p>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setBillingType('PIX')}
          className={`rounded-lg border px-4 py-2 text-sm ${
            billingType === 'PIX' ? 'border-brass bg-brass/10 text-brass' : 'border-charcoal-light text-charcoal-muted'
          }`}
        >
          Pix
        </button>
        <button
          type="button"
          onClick={() => setBillingType('CREDIT_CARD')}
          className={`rounded-lg border px-4 py-2 text-sm ${
            billingType === 'CREDIT_CARD' ? 'border-brass bg-brass/10 text-brass' : 'border-charcoal-light text-charcoal-muted'
          }`}
        >
          Cartão
        </button>
      </div>

      <button
        onClick={() => onSubscribe(billingType)}
        disabled={loading}
        className="rounded bg-brass px-8 py-3 font-semibold text-charcoal hover:bg-brass-light transition-colors disabled:opacity-50"
      >
        {loading
          ? 'Processando...'
          : isTrialExpired
            ? `Assinar com ${billingType === 'PIX' ? 'Pix' : 'cartão'}`
            : `Regularizar com ${billingType === 'PIX' ? 'Pix' : 'cartão'}`}
      </button>
      {error && <p className="mt-4 max-w-md text-sm text-red-400">{error}</p>}
      <Link to="/painel" className="mt-4 text-sm text-charcoal-muted hover:text-brass">
        Voltar ao painel
      </Link>
      <DeleteShopControl shopName={shopName} segment={segment} variant="inline" />
    </div>
  )
}
