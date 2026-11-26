import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {maskResponsiblePhone} from '../lib/responsibleContact'
export function AdminResponsibleContact({shopId}:{shopId:string}){
 const [phone,setPhone]=useState<string|null>(null),[error,setError]=useState(false)
 useEffect(()=>{let active=true;void supabase.rpc('admin_responsible_contact',{p_shop_id:shopId}).then(r=>{if(active){setError(!!r.error);setPhone(r.data?.phone||null)}});return()=>{active=false}},[shopId])
 return <section className="rounded-xl border border-white/10 p-4"><h2 className="font-semibold">WhatsApp do responsável</h2><p className="mt-2 text-sm text-neutral-400">{error?'Não foi possível consultar o contato.':phone?maskResponsiblePhone(phone):'Não informado · cadastro antigo ou aguardando preenchimento na ativação.'}</p>{phone&&<a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-lg bg-brass px-4 py-3 font-semibold text-charcoal">Conversar no WhatsApp</a>}</section>
}
