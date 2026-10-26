import type {BookingStatus} from '../lib/types'
export type BookingActionStatus='confirmed'|'in_progress'|'awaiting_payment'|'no_show'|'cancelled'
interface Props {status?:BookingStatus;busy?:boolean;includeAwaitingPayment?:boolean;compact?:boolean;onStatusChange:(status:BookingActionStatus)=>void;onComplete:()=>void;className?:string}
export function BookingActions({status='scheduled',busy=false,includeAwaitingPayment=false,onStatusChange,onComplete,className=''}:Props){
 const primary=status==='scheduled'?'Confirmar':status==='confirmed'?'Iniciar':'Finalizar atendimento'
 const run=()=>status==='scheduled'?onStatusChange('confirmed'):status==='confirmed'?onStatusChange('in_progress'):onComplete()
 return <div className={`mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 ${className}`}>
  <button type="button" disabled={busy} onClick={run} className="min-h-11 rounded-lg bg-brass px-3 py-2.5 text-center text-sm font-semibold text-charcoal disabled:opacity-50">{busy?'Salvando...':primary}</button>
  <details className="relative"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border border-charcoal-light px-3 py-2.5 text-sm text-charcoal-muted">Mais ações</summary><div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-charcoal-light bg-charcoal p-2 shadow-xl">
  {status==='scheduled'&&<Action label="Iniciar" busy={busy} onClick={()=>onStatusChange('in_progress')}/>}
  {['scheduled','confirmed'].includes(status)&&<Action label="Finalizar atendimento" busy={busy} onClick={onComplete}/>}
  {includeAwaitingPayment&&status==='in_progress'&&<Action label="Aguardando pagamento" busy={busy} onClick={()=>onStatusChange('awaiting_payment')}/>}
  <Action label="Não compareceu" busy={busy} onClick={()=>onStatusChange('no_show')}/><Action label="Cancelar atendimento" busy={busy} onClick={()=>onStatusChange('cancelled')}/>
  </div></details>
 </div>
}
function Action({label,busy,onClick}:{label:string;busy:boolean;onClick:()=>void}){return <button type="button" disabled={busy} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');onClick()}} className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/5 disabled:opacity-50">{label}</button>}
