import { useState } from 'react'
import type { Shop } from '../lib/types'
import { billingDate, type SubscriptionBilling } from '../lib/subscriptionBilling'
import { invokeFunction } from '../lib/supabase'

interface Props {
  shop: Shop
  email: string
  billing: SubscriptionBilling
  onSaved: () => void
  onCancel: () => void
}
export function SubscriptionCardForm({shop,email,billing,onSaved,onCancel}:Props) {
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const submit = async (event:React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const get=(name:string)=>String(fields.get(name)??'').trim()
    const expiry=get('expiry').split('/')
    setSaving(true); setError('')
    try {
      await invokeFunction<SubscriptionBilling>('manage-subscription',{
        shop_id:shop.id,action:'enable_card',request_id:crypto.randomUUID(),consent:fields.get('consent')==='on',
        card:{holderName:get('holderName'),number:get('cardNumber'),expiryMonth:expiry[0],expiryYear:expiry[1],ccv:get('ccv')},
        holder:{email:get('email'),cpfCnpj:get('document'),postalCode:get('postalCode'),addressNumber:get('addressNumber'),phone:get('phone')},
      })
      form.reset() // Never persist card values in browser storage or application state.
      onSaved()
    } catch {
      setError('Não foi possível cadastrar o cartão. Confira os dados e atualize o plano antes de tentar novamente.')
      form.querySelector<HTMLInputElement>('[name=ccv]')!.value=''
    } finally { setSaving(false) }
  }
  const inputClass='mt-2 min-h-11 w-full min-w-0 rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-base text-white focus:border-brass focus:outline-none'
  return <form onSubmit={submit} className="mt-5 space-y-4" autoComplete="off" aria-label="Cadastrar renovação automática">
    <p className="text-sm text-charcoal-muted">Cadastro sem cobrança imediata. A renovação é mensal, por R$ 60,00{billing.nextDueDate?`, com próxima cobrança em ${billingDate(billing.nextDueDate)}`:''}.</p>
    <label className="block text-sm text-white">Nome no cartão<input name="holderName" autoComplete="cc-name" required minLength={3} maxLength={100} className={inputClass}/></label>
    <label className="block text-sm text-white">Número do cartão<input name="cardNumber" autoComplete="cc-number" inputMode="numeric" required pattern="[0-9 ]{13,23}" maxLength={23} className={inputClass}/></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="block min-w-0 text-sm text-white">Validade<input name="expiry" placeholder="MM/AAAA" inputMode="numeric" autoComplete="cc-exp" required pattern="(0[1-9]|1[0-2])/[0-9]{4}" maxLength={7} className={inputClass}/></label>
      <label className="block min-w-0 text-sm text-white">CVV<input name="ccv" type="password" inputMode="numeric" autoComplete="cc-csc" required pattern="[0-9]{3,4}" maxLength={4} className={inputClass}/></label>
    </div>
    <label className="block text-sm text-white">E-mail do titular<input name="email" type="email" autoComplete="email" defaultValue={email} required maxLength={160} className={inputClass}/></label>
    <label className="block text-sm text-white">CPF ou CNPJ do titular<input name="document" defaultValue={shop.cpf_cnpj??''} inputMode="numeric" required maxLength={18} className={inputClass}/></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="block min-w-0 text-sm text-white">CEP<input name="postalCode" inputMode="numeric" autoComplete="postal-code" required pattern="[0-9]{5}-?[0-9]{3}" maxLength={9} className={inputClass}/></label>
      <label className="block min-w-0 text-sm text-white">Número do endereço<input name="addressNumber" autoComplete="address-line2" required maxLength={20} className={inputClass}/></label>
    </div>
    <label className="block text-sm text-white">Telefone do titular<input name="phone" type="tel" autoComplete="tel-national" required maxLength={20} className={inputClass}/></label>
    <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-white"><input name="consent" type="checkbox" required className="mt-1.5 h-5 w-5 shrink-0 accent-brass"/>Autorizo a cobrança mensal de R$ 60,00 neste cartão. Posso desativar a renovação automática nesta tela.</label>
    <p className="text-xs text-charcoal-muted">O cartão é processado pelo Asaas. Número completo e CVV não ficam salvos no onefind.</p>
    {error&&<p role="alert" className="text-sm text-red-400">{error}</p>}
    <div className="flex flex-col gap-3 sm:flex-row">
      <button disabled={saving} className="min-h-12 rounded-lg bg-brass px-4 py-3 text-sm font-semibold text-charcoal disabled:opacity-50">{saving?'Cadastrando...':'Autorizar renovação mensal'}</button>
      <button type="button" disabled={saving} onClick={onCancel} className="min-h-12 rounded-lg border border-charcoal-light px-4 py-3 text-sm text-white disabled:opacity-50">Cancelar</button>
    </div>
  </form>
}
