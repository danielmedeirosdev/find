import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandAccent } from './BrandAccent'
import { DeleteShopControl } from './DeleteShopControl'
import { formatPrice } from '../lib/format'
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
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-3 py-8 sm:px-6">
      <section className="w-full overflow-hidden rounded-3xl border border-brass/25 bg-gradient-to-b from-brass/[0.08] via-charcoal-dark to-charcoal-dark shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="px-5 pb-5 pt-7 text-center sm:px-8 sm:pt-9">
          <BrandAccent className="mx-auto mb-6 max-w-xs" height="h-1.5" segment={seg.id} />

          <p className="mx-auto mb-3 inline-flex rounded-full border border-brass/25 bg-brass/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass">
            {isTrialExpired ? 'Seu período grátis terminou' : 'Assinatura pendente'}
          </p>

          <h2 className="mx-auto max-w-2xl text-balance font-display text-4xl leading-tight text-white sm:text-5xl">
            {isTrialExpired ? 'Continue com tudo que você já organizou.' : 'Reative sua conta e continue de onde parou.'}
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-charcoal-muted sm:text-base">
            {isTrialExpired ? (
              <>
                O teste de <strong className="text-white">{shopName}</strong> terminou, mas sua configuração continua salva.
                Assine o onefind para voltar ao painel e seguir usando sua rotina normalmente.
              </>
            ) : (
              <>
                <strong className="text-white">{shopName}</strong> está temporariamente bloqueado{seg.id === 'pet' ? '' : 'a'}.
                Regularize a assinatura para recuperar o acesso completo.
              </>
            )}
          </p>
        </div>

        <div className="mx-4 mb-5 rounded-2xl border border-white/5 bg-black/15 p-4 sm:mx-8 sm:p-5">
          <div className="grid gap-3 text-left sm:grid-cols-2">
            {[
              'Seus clientes, pets e histórico continuam salvos',
              'Sua agenda e configurações ficam preservadas',
              'Acesso completo liberado após a confirmação',
              'Sem taxa de ativação ou fidelidade',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-brass">✓</span>
                <p className="text-sm leading-5 text-charcoal-muted">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/5 px-5 pb-7 pt-5 sm:px-8 sm:pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.16em] text-charcoal-muted">Plano mensal</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-3xl text-brass">{formatPrice(SUBSCRIPTION_PRICE)}</span>
                <span className="text-sm text-charcoal-muted">/mês</span>
              </div>
              <p className="mt-1 text-xs text-charcoal-muted">Cancele quando quiser.</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBillingType('PIX')}
                className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition ${
                  billingType === 'PIX'
                    ? 'border-brass bg-brass/15 text-brass'
                    : 'border-charcoal-light bg-black/10 text-charcoal-muted hover:text-white'
                }`}
              >
                Pix
              </button>
              <button
                type="button"
                onClick={() => setBillingType('CREDIT_CARD')}
                className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition ${
                  billingType === 'CREDIT_CARD'
                    ? 'border-brass bg-brass/15 text-brass'
                    : 'border-charcoal-light bg-black/10 text-charcoal-muted hover:text-white'
                }`}
              >
                Cartão
              </button>
            </div>
          </div>

          <button
            onClick={() => onSubscribe(billingType)}
            disabled={loading}
            className="mt-5 min-h-14 w-full rounded-xl bg-brass px-6 text-base font-semibold text-charcoal transition hover:bg-brass-light disabled:opacity-50"
          >
            {loading
              ? 'Processando...'
              : isTrialExpired
                ? `Continuar com ${billingType === 'PIX' ? 'Pix' : 'cartão'}`
                : `Reativar com ${billingType === 'PIX' ? 'Pix' : 'cartão'}`}
          </button>

          <p className="mt-3 text-center text-xs text-charcoal-muted">
            Seus dados permanecem salvos. O acesso é reativado após a confirmação do pagamento.
          </p>

          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

          <div className="mt-5 flex flex-col items-center gap-3 border-t border-white/5 pt-5">
            <Link to="/painel" className="text-sm text-charcoal-muted transition hover:text-brass">
              Voltar ao painel
            </Link>
            <details className="text-center">
              <summary className="cursor-pointer list-none text-xs text-charcoal-muted/70 hover:text-charcoal-muted">
                Não quero continuar com o onefind
              </summary>
              <div className="mt-3">
                <DeleteShopControl shopName={shopName} segment={segment} variant="inline" />
              </div>
            </details>
          </div>
        </div>
      </section>
    </div>
  )
}
