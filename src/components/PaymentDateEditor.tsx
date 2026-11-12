import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { paymentToday } from '../lib/finance'
import type { FinancialTransaction } from '../lib/types'

type Change = { id: string; previous_date: string | null; new_date: string | null; reason: string; changed_at: string; changed_by: string | null }
const dateLabel = (date: string | null) => date ? date.split('-').reverse().join('/') : 'Não informada'
export function PaymentDateEditor({ transaction, onSaved }: { transaction: FinancialTransaction; onSaved: () => void }) {
 const [open,setOpen]=useState(false),[date,setDate]=useState(transaction.paid_on || paymentToday()),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState<Change[]>([])
 const show=async()=>{setOpen(true);const r=await supabase.from('payment_date_history').select('*').eq('transaction_id',transaction.id).order('changed_at',{ascending:false});if(r.error)setError('Não foi possível carregar o histórico.');else setHistory(r.data || [])}
 const save=async()=>{if(busy)return;setBusy(true);setError('');const r=await supabase.rpc('correct_payment_date',{p_transaction_id:transaction.id,p_paid_on:date,p_reason:reason.trim()});setBusy(false);if(r.error){setError('Não foi possível corrigir. Confira a data e o motivo.');return}setOpen(false);onSaved()}
 return <div className="mt-2 text-sm">
 {!open ? <button type="button" className="min-h-11 text-brass underline" onClick={()=>void show()}>{transaction.paid_on ? 'Corrigir data / histórico' : 'Informar data / histórico'}</button> : <div className="space-y-3 rounded-lg border border-charcoal-light p-3">
 <label className="block text-white">Data efetiva do pagamento<input type="date" required max={paymentToday()} value={date} onChange={e=>setDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg bg-charcoal-dark p-2"/></label>
 <label className="block text-white">Motivo da correção<input value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg bg-charcoal-dark p-2"/></label>
 <p className="text-xs text-charcoal-muted">Altera a data deste lançamento e dos relatórios. O valor recebido permanece o mesmo.</p>
 {error && <p role="alert" className="text-red-400">{error}</p>}
 <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || !date || reason.trim().length<3} onClick={()=>void save()} className="min-h-11 rounded-lg bg-brass px-3 text-charcoal disabled:opacity-50">Salvar data</button><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="min-h-11 text-white">Cancelar</button></div>
 <details><summary className="min-h-11 text-brass">Histórico de datas</summary>{!history.length && <p className="text-charcoal-muted">Sem alterações registradas.</p>}{history.map(h=><p key={h.id} className="mb-2 break-words text-xs text-charcoal-muted">{dateLabel(h.previous_date)} → {dateLabel(h.new_date)} · {h.reason} · {new Date(h.changed_at).toLocaleString('pt-BR')}{h.changed_by ? ` · Responsável ${h.changed_by.slice(0,8)}` : ''}</p>)}</details>
 </div>}
 </div>
}
