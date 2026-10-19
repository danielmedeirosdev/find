import { useEffect, useState, type FormEvent } from 'react'
import { parseOnboardingProfile, parseOnboardingServices, parseOnboardingStaff, PET_BUSINESS_TYPES, type OnboardingServiceInput, type OnboardingStaffInput } from '../../lib/onboarding'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { invokeFunction } from '../../lib/supabase'

export function AssistedSetup() {
  const { user, loading } = useAuth()
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [link, setLink] = useState('')
  const [shopId, setShopId] = useState('')
  const [pending, setPending] = useState<{id:string;name:string}[]>([])
  const [slogan, setSlogan] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [services, setServices] = useState<OnboardingServiceInput[]>([{name:'',price:'',duration:''}])
  const [staff, setStaff] = useState<OnboardingStaffInput[]>([{name:'',role:''}])
  const [days, setDays] = useState<number[]>([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(()=>{if(!loading && user?.app_metadata?.onefind_platform_admin===true){void invokeFunction<{shops:{id:string;name:string}[]}>('create-assisted-shop',{action:'list'}).then(data=>setPending(data.shops)).catch(()=>{})}},[loading,user])
  if (loading) return <p>Carregando...</p>
  if (!user) return <Navigate to="/painel" replace />
  if (user.app_metadata?.onefind_platform_admin !== true) return <Navigate to="/painel/dashboard" replace />

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!window.confirm('Confirma que o responsável autorizou a criação desta conta?')) return
    setBusy(true); setError(''); setLink('')
    try {
      const data = await invokeFunction<{ shopId: string }>('create-assisted-shop', { action: 'create', shopName, email })
      setShopId(data.shopId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o convite.')
    } finally { setBusy(false) }
  }
  async function finish(e: FormEvent) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const profile = parseOnboardingProfile({ slogan, address, phone })
      const parsedServices = parseOnboardingServices(services)
      const parsedStaff = parseOnboardingStaff(staff)
      if (!parsedServices.length || !parsedStaff.length || !days.length || !start || !end || end <= start) throw new Error('Preencha serviços, equipe e horários válidos.')
      const data = await invokeFunction<{ actionLink: string }>('create-assisted-shop', { action: 'finish', shopId, profile, businessType, services: parsedServices, staff: parsedStaff, days, start, end })
      setLink(data.actionLink)
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível preparar a loja.') }
    finally { setBusy(false) }
  }
  const message = `Oi! Deixei sua loja preparada no onefind. Para ativar seu acesso e criar sua senha, abra este link: ${link}`
  return <section className="mx-auto max-w-lg space-y-6">
    <h1 className="text-2xl font-semibold tracking-tight text-white">Configuração assistida</h1>
    <p className="text-sm leading-relaxed text-neutral-400">Prepare o acesso de uma loja e envie o convite ao responsável.</p>
    {!shopId && pending.length>0 && <div className="space-y-2"><h2 className="text-sm font-semibold text-brass">Continuar configuração pendente</h2>{pending.map(s=><button key={s.id} type="button" className="block w-full rounded-lg border border-white/20 p-3 text-left" onClick={()=>{setShopId(s.id);setShopName(s.name)}}>{s.name}</button>)}</div>}
    {!shopId && <form onSubmit={create} className="space-y-5">
      <label className="block text-sm font-medium text-neutral-200">Nome da loja<input className="mt-2 block w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-neutral-500 focus:border-brass" value={shopName} onChange={e => setShopName(e.target.value)} required /></label>
      <label className="block">E-mail do responsável<input className="mt-2 block w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-neutral-500 focus:border-brass" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <button disabled={busy} className="rounded-xl bg-brass px-5 py-3 font-semibold text-charcoal transition hover:bg-brass-light disabled:opacity-50">{busy ? 'Preparando...' : 'Criar loja e convite'}</button>
    </form>}
    {shopId && !link && <form onSubmit={finish} className="space-y-5">
      <h2 className="text-lg font-semibold text-brass">Preparar a loja</h2>
      <p className="text-sm text-neutral-400">Preencha os dados confirmados pelo responsável. O convite só será liberado depois.</p>
      <label className="block text-sm">Ramo<select required className="mt-2 block w-full rounded-xl border border-white/20 bg-neutral-800 p-3" value={businessType} onChange={e=>setBusinessType(e.target.value)}><option value="">Selecione</option>{PET_BUSINESS_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      <label className="block text-sm">Slogan<input required maxLength={120} className="mt-2 block w-full rounded-xl border border-white/20 bg-white/10 p-3" value={slogan} onChange={e=>setSlogan(e.target.value)}/></label>
      <label className="block text-sm">Endereço<input required className="mt-2 block w-full rounded-xl border border-white/20 bg-white/10 p-3" value={address} onChange={e=>setAddress(e.target.value)}/></label>
      <label className="block text-sm">WhatsApp<input required type="tel" className="mt-2 block w-full rounded-xl border border-white/20 bg-white/10 p-3" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
      <h3 className="font-semibold">Serviços</h3>
      {services.map((s,i)=><div key={i} className="grid grid-cols-3 gap-2"><input aria-label="Serviço" placeholder="Nome" required className="min-w-0 rounded-lg border border-white/20 bg-white/10 p-2" value={s.name} onChange={e=>setServices(v=>v.map((x,j)=>i===j?{...x,name:e.target.value}:x))}/><input aria-label="Preço" placeholder="R$" required inputMode="decimal" className="min-w-0 rounded-lg border border-white/20 bg-white/10 p-2" value={s.price} onChange={e=>setServices(v=>v.map((x,j)=>i===j?{...x,price:e.target.value}:x))}/><input aria-label="Duração em minutos" placeholder="Min" required inputMode="numeric" className="min-w-0 rounded-lg border border-white/20 bg-white/10 p-2" value={s.duration} onChange={e=>setServices(v=>v.map((x,j)=>i===j?{...x,duration:e.target.value}:x))}/></div>)}
      <button type="button" className="text-brass underline" onClick={()=>setServices(v=>[...v,{name:'',price:'',duration:''}])}>Adicionar serviço</button>
      <h3 className="font-semibold">Equipe</h3>
      {staff.map((s,i)=><div key={i} className="grid grid-cols-2 gap-2"><input aria-label="Nome do profissional" placeholder="Nome" required className="min-w-0 rounded-lg border border-white/20 bg-white/10 p-2" value={s.name} onChange={e=>setStaff(v=>v.map((x,j)=>i===j?{...x,name:e.target.value}:x))}/><input aria-label="Função" placeholder="Função" className="min-w-0 rounded-lg border border-white/20 bg-white/10 p-2" value={s.role} onChange={e=>setStaff(v=>v.map((x,j)=>i===j?{...x,role:e.target.value}:x))}/></div>)}
      <button type="button" className="text-brass underline" onClick={()=>setStaff(v=>[...v,{name:'',role:''}])}>Adicionar profissional</button>
      <h3 className="font-semibold">Dias de atendimento</h3>
      <div className="flex flex-wrap gap-3">{[['Dom',0],['Seg',1],['Ter',2],['Qua',3],['Qui',4],['Sex',5],['Sáb',6]].map(([label,day])=><label key={day} className="flex items-center gap-1"><input type="checkbox" checked={days.includes(Number(day))} onChange={e=>setDays(v=>e.target.checked?[...v,Number(day)]:v.filter(x=>x!==day))}/>{label}</label>)}</div>
      <div className="grid grid-cols-2 gap-3"><label>Início<input type="time" required className="block w-full rounded-lg bg-neutral-800 p-3" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Fim<input type="time" required className="block w-full rounded-lg bg-neutral-800 p-3" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
      <button disabled={busy} className="rounded-xl bg-brass px-5 py-3 font-semibold text-charcoal">{busy?'Salvando...':'Finalizar e gerar convite'}</button>
    </form>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {link && <div className="space-y-3">
      <p>Convite criado. Envie apenas ao responsável autorizado.</p>
      <button className="bg-brass text-charcoal p-3 rounded-lg" onClick={() => navigator.clipboard.writeText(message)}>Copiar mensagem para WhatsApp</button>
      <a className="block underline" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
    </div>}
  </section>
}
