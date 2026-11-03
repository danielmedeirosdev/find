import { useCallback, useEffect, useState } from 'react'
import { supabase, invokeFunction } from '../../../lib/supabase'
import { formatPrice, subscriptionLabel, getTrialDaysRemaining } from '../../../lib/format'
import { SUBSCRIPTION_PRICE, type Shop, type BillingType, type SubscribeHandler } from '../../../lib/types'
import { BrandAccent } from '../../../components/BrandAccent'
import { PaymentBrands } from '../../../components/PaymentBrands'
import { SubscriptionCardForm } from '../../../components/SubscriptionCardForm'
import { billingDate, type SubscriptionBilling } from '../../../lib/subscriptionBilling'
import { useAuth } from '../../../contexts/AuthContext'

interface Props {
  shop: Shop
  onUpdate: () => void
  onSubscribe: SubscribeHandler
  subscribing: boolean
  subscribeError?: string
}

export function SubscriptionTab({ shop, onUpdate, onSubscribe, subscribing, subscribeError }: Props) {
  const { user } = useAuth()
  const [billing, setBilling] = useState<SubscriptionBilling|null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [billingError, setBillingError] = useState('')
  const [cardOpen, setCardOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [changing, setChanging] = useState(false)
  const [billingMessage, setBillingMessage] = useState('')
  const loadBilling = useCallback(async () => {
    setBillingLoading(true); setBillingError('')
    try { setBilling(await invokeFunction<SubscriptionBilling>('manage-subscription', {shop_id:shop.id,action:'summary'})) }
    catch { setBillingError('Não foi possível consultar o plano agora.') }
    finally { setBillingLoading(false) }
  }, [shop.id])
  useEffect(() => { void loadBilling() }, [loadBilling])
  useEffect(() => {
    const refresh = () => { if(document.visibilityState==='visible') void loadBilling() }
    window.addEventListener('focus',refresh)
    return () => window.removeEventListener('focus',refresh)
  }, [loadBilling])
  const handleUsePix = async () => {
    setChanging(true); setBillingMessage('')
    try {
      await invokeFunction('manage-subscription', {shop_id:shop.id,action:'use_pix',consent:true,request_id:crypto.randomUUID()})
      setDisableOpen(false); setBillingMessage('Renovação automática desativada. Próximos pagamentos por Pix manual.')
      await loadBilling()
    } catch { setBillingMessage('Não foi possível confirmar a alteração. Atualize os dados antes de tentar novamente.') }
    finally { setChanging(false) }
  }
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

  const trialDays = shop.subscription_status === 'trial' ? getTrialDaysRemaining(shop.trial_ends_at) : null
  const trialUrgent = trialDays !== null && trialDays <= 3
  const complimentaryActive =
    Boolean(shop.complimentary_until) && new Date(shop.complimentary_until as string) > new Date()
  const complimentaryDays = shop.complimentary_until
    ? Math.max(0, Math.ceil((new Date(shop.complimentary_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <div className="of-workspace max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-2xl text-white">Assinatura</h2><button type="button" onClick={()=>void loadBilling()} disabled={billingLoading} className="min-h-11 text-xs text-charcoal-muted disabled:opacity-50">{billingLoading?'Consultando...':'Consultar situação do pagamento'}</button></div>

      {complimentaryActive && (
        <div className="rounded-lg border border-brass/40 bg-brass/5 p-4 mb-6">
          <p className="text-sm font-medium text-white">Mês grátis de indicação ativo</p>
          <p className="text-xs text-charcoal-muted mt-1">
            {complimentaryDays === 1
              ? 'Seu crédito termina amanhã.'
              : `Seu crédito vale por mais ${complimentaryDays} dias.`}
          </p>
        </div>
      )}
      {shop.subscription_status === 'trial' && trialDays !== null && (
        <div
          className={`rounded-lg border p-4 mb-6 ${
            trialUrgent
              ? 'border-yellow-500/50 bg-yellow-500/10'
              : 'border-charcoal-light bg-charcoal/50'
          }`}
        >
          <p className={`text-sm font-medium ${trialUrgent ? 'text-yellow-300' : 'text-white'}`}>
            {trialDays === 0
              ? 'Seu teste grátis termina hoje!'
              : trialDays === 1
                ? 'Seu teste grátis termina amanhã!'
                : `Seu teste grátis termina em ${trialDays} dias`}
          </p>
          {trialUrgent && (
            <p className="text-xs text-yellow-400/80 mt-1">
              Assine agora para não perder o acesso ao painel e aos agendamentos online.
            </p>
          )}
        </div>
      )}

      <div className="of-work-panel mb-6">
        <BrandAccent className="mb-4" segment={shop.segment === 'pet' ? 'pet' : 'barbershop'} />
        <p className="text-charcoal-muted text-sm mb-1">Plano onefind</p>
        <p className="font-mono text-3xl text-brass mb-4">
          {formatPrice(SUBSCRIPTION_PRICE)}<span className="text-lg text-charcoal-muted">/mês</span>
        </p>
        <p className="text-sm">
          Status:{' '}
          <span className={`font-semibold ${statusColor}`}>
            {subscriptionLabel(shop.subscription_status)}
          </span>
        </p>
        <div className="mt-5 space-y-3 text-sm">
          {billingLoading && !billing && <p className="text-charcoal-muted" role="status">Consultando datas do plano...</p>}
          {billing?.paidUntil && <>
            <p className="text-white">Acesso pago até <strong>{billingDate(billing.paidUntil)}</strong></p>
            <p className="text-charcoal-muted">{billing.daysRemaining === 1 ? '1 dia restante' : `${billing.daysRemaining} dias restantes`}</p>
          </>}
          {billing?.nextDueDate && <p className="text-white">Próxima cobrança: <strong>{billingDate(billing.nextDueDate)}</strong></p>}
          {billing && <p className="text-charcoal-muted">{!billing.hasSubscription ? 'Assinatura ainda não contratada.' : billing.automaticRenewal ? `Renovação automática no cartão${billing.cardLast4 ? ` final ${billing.cardLast4}` : ''}.` : billing.billingType === 'CREDIT_CARD' ? 'Cartão ainda não confirmado para renovação automática.' : 'Pix manual: pague a fatura a cada mês.'}</p>}
          {billing && shop.subscription_status==='active' && !billing.paidUntil && <p className="text-charcoal-muted">Período pago ainda não confirmado pelo Asaas.</p>}
          {billingError && <p role="alert" className="text-red-400">{billingError}</p>}

        </div>
      </div>

      {billing?.hasSubscription && shop.subscription_status==='active' && <section className="of-work-panel mb-6 payment-method">
        <div className="payment-heading"><div><p className="text-xs text-brass mb-2">FORMA DE PAGAMENTO</p><h3 className="text-xl font-semibold text-white">Cartão de crédito</h3></div><svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brass"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h4"/></svg></div>
        <PaymentBrands />
        <p className="mt-3 text-sm text-charcoal-muted">Renovação mensal de R$ 60,00. Cadastro sem cobrança imediata.</p>
        {billing.automaticRenewal && <div className="payment-saved"><span>{billing.cardBrand || 'Cartão cadastrado'}</span><strong>•••• {billing.cardLast4 || '••••'}</strong><span>Renovação automática ativada</span></div>}
        {!cardOpen && !disableOpen && <>
          <p className="mt-2 text-sm leading-6 text-charcoal-muted">{billing.automaticRenewal ? 'A mensalidade será cobrada no cartão na data do vencimento.' : 'Cadastre um cartão para renovar sem pagar a fatura manualmente.'}</p>
          <button type="button" onClick={()=>{setCardOpen(true);setBillingMessage('')}} disabled={!billing.canConfigureCard || billingLoading} className="mt-4 min-h-12 w-full rounded-lg bg-brass px-4 py-3 text-sm font-semibold text-charcoal disabled:opacity-50">{billing.automaticRenewal?'Trocar cartão':'Cadastrar cartão de crédito'}</button>
          {!billing.canConfigureCard && <p className="mt-2 text-sm text-charcoal-muted">Regularize a mensalidade atual antes de configurar o cartão.</p>}
          {billing.automaticRenewal && <button type="button" onClick={()=>setDisableOpen(true)} className="mt-3 min-h-11 w-full text-sm text-charcoal-muted hover:text-white">Desativar renovação automática</button>}
          <p className="mt-4 text-xs leading-5 text-charcoal-muted">Cartão de débito não está disponível para esta renovação automática.</p><p className="mt-2 text-xs leading-5 text-charcoal-muted">Pix Automático {billing.pixAutomatic==='unavailable'?'indisponível para a conta recebedora atual.':'ainda não habilitado.'} O Pix disponível continua sendo manual.</p>
        </>}
        {cardOpen && <SubscriptionCardForm shop={shop} email={user?.email??''} billing={billing} onCancel={()=>setCardOpen(false)} onSaved={()=>{setCardOpen(false);setBillingMessage('Cartão confirmado para renovação mensal.');void loadBilling()}}/>}
        {disableOpen && <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-white">Desativar a cobrança no cartão e receber as próximas mensalidades por Pix manual? Seu período pago será preservado.</p>
          <button type="button" disabled={changing} onClick={()=>void handleUsePix()} className="min-h-12 w-full rounded-lg border border-brass px-4 text-sm text-brass disabled:opacity-50">{changing?'Alterando...':'Confirmar Pix manual'}</button>
          <button type="button" disabled={changing} onClick={()=>setDisableOpen(false)} className="min-h-11 w-full text-sm text-white">Manter cartão</button>
        </div>}
        {billingMessage && <p role="status" className="mt-4 text-sm text-white">{billingMessage}</p>}
      </section>}

      <div className="of-work-panel mb-6 space-y-4">
        <h3 className="font-medium text-white">Dados de cobrança</h3>
        <p className="text-xs text-charcoal-muted">CPF ou CNPJ do responsável.</p>
        <input
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
          placeholder="Ex: 000.000.000-00 ou 00.000.000/0000-00"
          className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
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
