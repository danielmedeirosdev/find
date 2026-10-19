import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { invokeFunction } from '../../lib/supabase'

type Detail = {
  shop: {id:string;name:string;slogan:string|null;address:string|null;phone:string|null;pet_business_type:string|null;subscription_status:string|null;trial_ends_at:string|null;onboarding_completed:boolean;created_at:string;owner_email:string|null}
  services: {id:string;name:string;price:number;duration_minutes:number}[]
  professionals: {id:string;name:string;role:string|null}[]
  schedules: {barber_id:string;day_of_week:number;start_time:string;end_time:string;is_active:boolean}[]
}
const weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v)
const date=(v:string|null)=>v?new Date(v).toLocaleDateString('pt-BR'):'Não informado'

export function AdminShopDetail(){
  const {shopId}=useParams()
  const [detail,setDetail]=useState<Detail|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    let active=true
    setLoading(true);setError('')
    void invokeFunction<Detail>('create-assisted-shop',{action:'details',shopId}).then(data=>{if(active)setDetail(data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível carregar a loja')}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[shopId])
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link to="/interno" className="text-sm text-brass">← Estabelecimentos</Link>
    {loading?<p className="text-neutral-400">Carregando estabelecimento...</p>:error?<p role="alert" className="rounded-xl border border-red-500/30 p-4 text-red-300">{error}</p>:detail&&<>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-widest text-brass">Estabelecimento</p><h1 className="mt-2 text-3xl font-semibold">{detail.shop.name}</h1><p className="mt-2 text-sm text-neutral-400">{detail.shop.owner_email||'E-mail indisponível'}</p></div>
        <span className="rounded-full border border-white/20 px-4 py-2 text-sm">{detail.shop.onboarding_completed?'Configurada':'Pendente'}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-lg font-semibold">Dados da loja</h2>
          {([['Ramo',detail.shop.pet_business_type],['Slogan',detail.shop.slogan],['Endereço',detail.shop.address],['WhatsApp',detail.shop.phone],['Cadastro',date(detail.shop.created_at)]]).map(([label,value])=><div key={label} className="border-b border-white/10 py-3 last:border-0"><p className="text-xs text-neutral-400">{label}</p><p className="mt-1 break-words text-sm">{value||'Não informado'}</p></div>)}
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-lg font-semibold">Assinatura</h2>
          <p className="text-xs text-neutral-400">Situação registrada</p><p className="mt-1 text-lg">{detail.shop.subscription_status||'Não informado'}</p>
          <p className="mt-5 text-xs text-neutral-400">Fim do período de teste</p><p className="mt-1">{date(detail.shop.trial_ends_at)}</p>
          <p className="mt-6 text-xs leading-relaxed text-neutral-500">Informações somente para consulta. Alterações financeiras exigem integração segura com o faturamento.</p>
        </section>
      </div>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-semibold">Serviços <span className="text-sm font-normal text-neutral-400">({detail.services.length})</span></h2>
        <div className="mt-3 divide-y divide-white/10">{detail.services.length?detail.services.map(s=><div key={s.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{s.name}</span><span className="text-neutral-300">{money(Number(s.price))} · {s.duration_minutes} min</span></div>):<p className="py-4 text-sm text-neutral-400">Nenhum serviço cadastrado.</p>}</div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-semibold">Equipe e horários <span className="text-sm font-normal text-neutral-400">({detail.professionals.length})</span></h2>
        <div className="mt-3 divide-y divide-white/10">{detail.professionals.length?detail.professionals.map(p=><div key={p.id} className="py-4"><p className="font-medium">{p.name} <span className="text-sm font-normal text-neutral-400">{p.role||''}</span></p><div className="mt-2 flex flex-wrap gap-2">{detail.schedules.filter(s=>s.barber_id===p.id&&s.is_active).sort((a,b)=>a.day_of_week-b.day_of_week).map(s=><span key={s.day_of_week} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-neutral-300">{weekdays[s.day_of_week]} {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</span>)}</div></div>):<p className="py-4 text-sm text-neutral-400">Nenhum profissional cadastrado.</p>}</div>
      </section>
      {!detail.shop.onboarding_completed&&<Link to={`/interno/nova?shop=${encodeURIComponent(detail.shop.id)}`} className="inline-flex rounded-xl bg-brass px-5 py-3 font-semibold text-charcoal">Continuar configuração</Link>}
    </>}
  </div>
}
