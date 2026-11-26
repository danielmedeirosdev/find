import {useEffect,useState,type ReactNode} from 'react'
import {supabase} from '../lib/supabase'
import {ResponsiblePhoneField} from './ResponsiblePhoneField'
import {normalizeResponsiblePhone} from '../lib/responsibleContact'
import {trackBusinessRegistration} from '../lib/analytics'
export function ResponsibleContactGate({children}:{children:ReactNode}) {
 const [state,setState]=useState<{required:boolean;shop_id?:string;method?:'email'|'google';new_registration?:boolean}|null>(null),[phone,setPhone]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0)
 useEffect(()=>{let active=true;void supabase.rpc('my_responsible_contact').then(r=>{if(!active)return;if(r.error){setError('Não foi possível verificar o contato. Tente novamente.');return}setState(r.data);if(r.data.new_registration&&!r.data.required)void trackBusinessRegistration(r.data.shop_id,r.data.method) });return()=>{active=false}},[retry])
 if(!state)return <div className="p-5 text-center"><p>{error||'Carregando...'}</p>{error&&<button onClick={()=>{setError('');setRetry(x=>x+1)}}>Tentar novamente</button>}</div>
 if(!state.required)return children
 return <form className="mx-auto max-w-md space-y-5 p-5" onSubmit={async e=>{e.preventDefault();if(!normalizeResponsiblePhone(phone)){setError('Informe um celular brasileiro com DDD válido e 11 dígitos.');return}setBusy(true);setError('');const r=await supabase.rpc('save_responsible_contact',{p_phone:normalizeResponsiblePhone(phone)});setBusy(false);if(r.error){setError('Não foi possível salvar seu contato. Tente novamente.');return}if(state.shop_id)void trackBusinessRegistration(state.shop_id,state.method||'email');setState({...state,required:false})}}><h1 className="text-2xl font-semibold text-white">Complete seu cadastro</h1><ResponsiblePhoneField value={phone} onChange={setPhone}/><p className="text-xs text-charcoal-muted">Este contato não altera o telefone público da loja. A validação do formato não confirma que o número possui WhatsApp.</p>{error&&<p role="alert" className="text-red-400">{error}</p>}<button disabled={busy} className="w-full rounded-lg bg-brass p-3 font-semibold text-charcoal">{busy?'Salvando...':'Concluir cadastro'}</button></form>
}
