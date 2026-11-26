import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
export function AdminInitialSetup({shopId}:{shopId:string}){
 const [info,setInfo]=useState<{mode:string|null;status:string;step:number}|null>(null)
 useEffect(()=>{let active=true;void supabase.rpc('admin_initial_setup',{p_shop_id:shopId}).then(r=>{if(active&&!r.error)setInfo(r.data)});return()=>{active=false}},[shopId])
 if(!info)return null
 return <p className="rounded-xl border border-brass/30 p-4 text-sm text-brass">{info.mode==='assisted'?'Configuração assistida solicitada':info.mode==='self'?`Configuração por conta própria · etapa ${info.step}/6`:'Aguardando escolha de configuração'} · {({active:'em andamento',deferred:'configurar depois',completed:'concluída',dismissed:'guia dispensado'} as Record<string,string>)[info.status]}</p>
}
