import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatPrice, formatDate } from '../lib/format'
import { userFacingError } from '../lib/userFacingError'
import { Modal } from './Modal'
type Debt={booking_id:string;client_name:string;booking_date:string;total:number;received:number;balance:number}
export function BookingReceivables({shopId,onReceived}:{shopId:string;onReceived:()=>void}) {
 const [rows,setRows]=useState<Debt[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 const [selected,setSelected]=useState<Debt|null>(null),[amount,setAmount]=useState(''),[method,setMethod]=useState('pix'),[busy,setBusy]=useState(false),[requestId,setRequestId]=useState('')
 const load=useCallback(async()=>{setLoading(true);const r=await supabase.rpc('booking_receivables',{p_shop_id:shopId});if(r.error)setError(userFacingError(r.error,'Não foi possível carregar as pendências.'));else {setRows(r.data||[]);setError('')}setLoading(false)},[shopId])
 useEffect(()=>{void load()},[load])
 const receive=async()=>{
  const value=Number(amount.replace(',','.'))
  if(busy||!selected)return
  if(!Number.isFinite(value)||value<=0||Math.round(value*100)>Math.round(Number(selected.balance)*100)){setError('Confira o valor recebido.');return}
  setBusy(true);setError('')
  const r=await supabase.rpc('receive_booking_payment',{p_booking_id:selected.booking_id,p_amount:value,p_method:method,p_request_id:requestId})
  setBusy(false)
  if(r.error){setError(userFacingError(r.error,'Não foi possível registrar. Tente novamente.'));return}
  setSelected(null);await load();onReceived()
 }
 return <section className="mb-6 rounded-xl border border-brass/25 p-4">
  <h3 className="font-semibold text-white">Pagamentos pendentes</h3>
  <p className="mt-1 text-sm text-charcoal-muted">Novas finalizações. Caixa na data do recebimento.</p>
  <p className="mt-2 text-xl text-brass">{formatPrice(rows.reduce((s,r)=>s+Number(r.balance),0))}</p>
  {loading?<p className="text-sm text-charcoal-muted">Carregando...</p>:!rows.length?<p className="mt-2 text-sm text-charcoal-muted">Nenhum pagamento pendente.</p>:rows.map(r=><div key={r.booking_id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-charcoal-light pt-3"><div className="min-w-0 break-words text-white"><p>{r.client_name}</p><p className="text-xs text-charcoal-muted">{formatDate(r.booking_date)} · Recebido {formatPrice(Number(r.received))}</p><p className="text-brass">Pendente {formatPrice(Number(r.balance))}</p></div><button className="min-h-11 rounded-lg bg-brass px-3 text-sm font-semibold text-charcoal" onClick={()=>{setSelected(r);setAmount(Number(r.balance).toFixed(2).replace('.',','));setMethod('pix');setRequestId(crypto.randomUUID());setError('')}}>Registrar pagamento</button></div>)}
  {error&&!selected&&<p role="alert" className="mt-3 text-red-400">{error}<button className="ml-2 underline" onClick={()=>void load()}>Tentar novamente</button></p>}
  {selected&&<Modal label="Registrar pagamento" onClose={()=>setSelected(null)} busy={busy} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl border border-charcoal-light bg-charcoal p-4"><h3 className="text-lg text-white">Registrar pagamento</h3><p className="my-3 break-words text-charcoal-muted">{selected.client_name} · Saldo {formatPrice(Number(selected.balance))}</p><label className="block text-sm text-white">Valor recebido (R$)<input inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setRequestId(crypto.randomUUID())}} className="mt-2 min-h-12 w-full rounded-lg border border-charcoal-light bg-charcoal-dark p-3"/></label><label className="mt-3 block text-sm text-white">Forma de pagamento<select value={method} onChange={e=>{setMethod(e.target.value);setRequestId(crypto.randomUUID())}} className="mt-2 min-h-12 w-full rounded-lg bg-charcoal-dark p-3"><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option></select></label><p className="mt-3 text-xs text-charcoal-muted">Aceita pagamento parcial.</p>{error&&<p role="alert" className="mt-3 text-red-400">{error}</p>}<div className="mt-4 grid grid-cols-2 gap-2"><button disabled={busy} className="min-h-12 rounded-lg border border-charcoal-light text-white" onClick={()=>setSelected(null)}>Cancelar</button><button disabled={busy} className="min-h-12 rounded-lg bg-brass font-semibold text-charcoal" onClick={()=>void receive()}>{busy?'Salvando...':'Registrar'}</button></div></div></Modal>}
 </section>
}
