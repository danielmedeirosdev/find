import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { invokeFunction, supabase } from '../../lib/supabase'
import { prepareImage } from '../../lib/media'
import { PET_BUSINESS_TYPES } from '../../lib/onboarding'
import { ImageDropzone } from '../../components/MediaUI'

type ServiceRow = {
  id?: string
  name: string
  price: string
  duration: string
  active: boolean
  transportEnabled: boolean
  transportFee: string
  transportMode: 'fixed' | 'quote'
}

type ScheduleRow = { day_of_week: number; is_active: boolean; start_time: string; end_time: string }

type StaffRow = {
  id?: string
  name: string
  role: string
  specialty: string
  commission: string
  photo_url: string
  schedules: ScheduleRow[]
}

type PackageRow = {
  id?: string
  name: string
  description: string
  total_sessions: string
  price: string
  validity_days: string
  active: boolean
}

type PhotoRow = { id?: string; url: string }
type ClosureRow = { id?: string; starts_on: string; ends_on: string; label: string }

const DAYS = [
  ['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6],
] as const

function blankSchedules(): ScheduleRow[] {
  return DAYS.map(([, day]) => ({ day_of_week: day, is_active: false, start_time: '08:00', end_time: '18:00' }))
}

function blankService(): ServiceRow {
  return { name: '', price: '', duration: '60', active: true, transportEnabled: false, transportFee: '0', transportMode: 'fixed' }
}

function blankStaff(): StaffRow {
  return { name: '', role: '', specialty: '', commission: '', photo_url: '', schedules: blankSchedules() }
}

function blankPackage(): PackageRow {
  return { name: '', description: '', total_sessions: '4', price: '', validity_days: '', active: true }
}

export function AssistedSetup() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const [shopId, setShopId] = useState('')
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState<{id:string;name:string}[]>([])
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const [businessType, setBusinessType] = useState('grooming')
  const [slogan, setSlogan] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [hoursText, setHoursText] = useState('')
  const [slug, setSlug] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [services, setServices] = useState<ServiceRow[]>([blankService()])
  const [staff, setStaff] = useState<StaffRow[]>([blankStaff()])
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [photos, setPhotos] = useState<PhotoRow[]>([])
  const [closures, setClosures] = useState<ClosureRow[]>([])

  useEffect(() => {
    if (loading || user?.app_metadata?.onefind_platform_admin !== true) return
    void invokeFunction<{shops:{id:string;name:string}[]}>('create-assisted-shop',{action:'list'})
      .then((data) => {
        setPending(data.shops)
        const selected = data.shops.find((s) => s.id === params.get('shop'))
        if (selected) void selectShop(selected.id, selected.name)
      })
      .catch(() => {})
  }, [loading, user, params])

  if (loading) return <p>Carregando...</p>
  if (!user) return <Navigate to="/painel" replace />
  if (user.app_metadata?.onefind_platform_admin !== true) return <Navigate to="/painel/dashboard" replace />

  async function selectShop(id: string, name?: string) {
    setBusy(true)
    setError('')
    try {
      const data = await invokeFunction<any>('create-assisted-shop', { action: 'details_full', shopId: id })
      setShopId(id)
      setShopName(data.shop.name || name || '')
      setEmail(data.shop.owner_email || '')
      setBusinessType(data.shop.pet_business_type || 'grooming')
      setSlogan(data.shop.slogan || '')
      setDescription(data.shop.description || '')
      setAddress(data.shop.address || '')
      setPhone(data.shop.phone || '')
      setHoursText(data.shop.hours_text || '')
      setSlug(data.shop.slug || '')
      setLogoUrl(data.shop.logo_url || '')
      setServices((data.services || []).length ? data.services.map((s:any) => ({
        id: s.id,
        name: s.name || '',
        price: String(s.price ?? ''),
        duration: String(s.duration_minutes ?? 60),
        active: s.is_active !== false,
        transportEnabled: s.transport?.enabled === true,
        transportFee: String(s.transport?.fee ?? 0),
        transportMode: s.transport?.pricing_mode === 'quote' ? 'quote' : 'fixed',
      })) : [blankService()])
      setStaff((data.professionals || []).length ? data.professionals.map((p:any) => ({
        id: p.id,
        name: p.name || '',
        role: p.role || '',
        specialty: p.specialty || '',
        commission: p.commission_percent == null ? '' : String(p.commission_percent),
        photo_url: p.photo_url || '',
        schedules: DAYS.map(([, day]) => {
          const row = (p.schedules || []).find((x:any) => Number(x.day_of_week) === day)
          return {
            day_of_week: day,
            is_active: row?.is_active === true,
            start_time: row?.start_time?.slice(0,5) || '08:00',
            end_time: row?.end_time?.slice(0,5) || '18:00',
          }
        }),
      })) : [blankStaff()])
      setPackages((data.packages || []).map((p:any) => ({
        id: p.id,
        name: p.name || '',
        description: p.description || '',
        total_sessions: String(p.total_sessions ?? 4),
        price: String(p.price ?? ''),
        validity_days: p.validity_days == null ? '' : String(p.validity_days),
        active: p.active !== false,
      })))
      setPhotos((data.photos || []).map((p:any) => ({ id: p.id, url: p.url })))
      setClosures((data.closures || []).map((c:any) => ({ id: c.id, starts_on: c.starts_on, ends_on: c.ends_on, label: c.label || 'Fechado' })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a loja.')
    } finally {
      setBusy(false)
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!window.confirm('Confirma que o responsável autorizou a criação desta conta?')) return
    setBusy(true); setError(''); setLink('')
    try {
      const data = await invokeFunction<{shopId:string}>('create-assisted-shop',{action:'create',shopName,email})
      await selectShop(data.shopId, shopName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a loja.')
    } finally { setBusy(false) }
  }

  async function uploadMedia(file: File, folder: 'logo' | 'gallery' | 'barbers') {
    if (!shopId) throw new Error('Crie ou selecione a loja primeiro.')
    const prepared = await prepareImage(file, folder)
    const data = await invokeFunction<{path:string;token:string;publicUrl:string}>('create-assisted-shop', {
      action:'media_upload_url',
      shopId,
      folder,
      ext: prepared.ext,
    })
    const { error: uploadError } = await supabase.storage
      .from('shop-media')
      .uploadToSignedUrl(data.path, data.token, prepared.blob, { contentType: prepared.contentType })
    if (uploadError) throw uploadError
    return data.publicUrl
  }

  async function uploadLogo(files: File[]) {
    const file = files[0]
    if (!file) return
    setBusy(true); setError('')
    try { setLogoUrl(await uploadMedia(file, 'logo')) }
    catch (err) { setError(err instanceof Error ? err.message : 'Erro ao enviar logo.') }
    finally { setBusy(false) }
  }

  async function uploadGallery(files: File[]) {
    setBusy(true); setError('')
    try {
      const urls: PhotoRow[] = []
      for (const file of files) urls.push({ url: await uploadMedia(file, 'gallery') })
      setPhotos((v) => [...v, ...urls])
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao enviar fotos.') }
    finally { setBusy(false) }
  }

  async function uploadStaffPhoto(index: number, files: File[]) {
    const file = files[0]
    if (!file) return
    setBusy(true); setError('')
    try {
      const url = await uploadMedia(file, 'barbers')
      setStaff((v) => v.map((p,i) => i === index ? { ...p, photo_url: url } : p))
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao enviar foto.') }
    finally { setBusy(false) }
  }

  const payload = useMemo(() => ({
    action:'save_full',
    shopId,
    businessType,
    profile:{ name: shopName, slogan, description, address, phone, hours_text: hoursText, slug, logo_url: logoUrl },
    services: services.filter((s) => s.name.trim()).map((s) => ({
      id:s.id,
      name:s.name.trim(),
      price:Number(s.price.replace(',','.')),
      duration_minutes:Number(s.duration),
      is_active:s.active,
      transport:{ enabled:s.transportEnabled, fee:Number(s.transportFee.replace(',','.')) || 0, pricing_mode:s.transportMode },
    })),
    staff: staff.filter((p) => p.name.trim()).map((p) => ({
      id:p.id,
      name:p.name.trim(),
      role:p.role.trim() || null,
      specialty:p.specialty.trim() || null,
      commission_percent:p.commission.trim() === '' ? null : Number(p.commission.replace(',','.')),
      photo_url:p.photo_url || null,
      schedules:p.schedules,
    })),
    packages: packages.filter((p) => p.name.trim()).map((p) => ({
      id:p.id,
      name:p.name.trim(),
      description:p.description.trim() || null,
      total_sessions:Number(p.total_sessions),
      price:Number(p.price.replace(',','.')),
      validity_days:p.validity_days.trim() ? Number(p.validity_days) : null,
      active:p.active,
    })),
    photos,
    closures,
  }), [shopId,businessType,shopName,slogan,description,address,phone,hoursText,slug,logoUrl,services,staff,packages,photos,closures])

  async function saveAll() {
    setBusy(true); setError(''); setSaved('')
    try {
      await invokeFunction('create-assisted-shop', payload)
      setSaved('Configuração salva.')
      await selectShop(shopId, shopName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a configuração.')
    } finally { setBusy(false) }
  }

  async function finish() {
    setBusy(true); setError(''); setSaved('')
    try {
      await invokeFunction('create-assisted-shop', payload)
      const data = await invokeFunction<{actionLink:string}>('create-assisted-shop',{action:'finish',shopId,fullSetup:true})
      setLink(data.actionLink)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o convite.')
    } finally { setBusy(false) }
  }

  const message = `Oi! Deixei sua loja preparada no onefind. Para ativar seu acesso e criar sua senha, abra este link: ${link}`

  return <section className="mx-auto max-w-5xl space-y-6 pb-16">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link to="/interno" className="text-sm text-brass">← Voltar ao painel</Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Configuração assistida completa</h1>
        <p className="mt-1 text-sm text-neutral-400">Monte a loja antes de entregar o acesso: perfil, fotos, serviços, táxi dog, equipe, horários, pacotes e dias fechados.</p>
      </div>
      {shopId && <button type="button" onClick={() => { setShopId(''); setLink(''); setShopName(''); setEmail('') }} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-300">Trocar loja</button>}
    </div>

    {!shopId && pending.length > 0 && <div className="rounded-2xl border border-white/10 p-4">
      <h2 className="mb-3 text-sm font-semibold text-brass">Continuar configuração pendente</h2>
      <div className="grid gap-2 sm:grid-cols-2">{pending.map((s) => <button key={s.id} type="button" onClick={() => void selectShop(s.id,s.name)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left text-white hover:border-brass/50">{s.name}</button>)}</div>
    </div>}

    {!shopId && <form onSubmit={create} className="grid gap-4 rounded-2xl border border-white/10 p-5 sm:grid-cols-2">
      <label className="text-sm text-neutral-300">Nome da loja<input required value={shopName} onChange={(e)=>setShopName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 p-3 text-white" /></label>
      <label className="text-sm text-neutral-300">E-mail do responsável<input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 p-3 text-white" /></label>
      <button disabled={busy} className="rounded-xl bg-brass px-5 py-3 font-semibold text-charcoal disabled:opacity-50 sm:col-span-2">{busy?'Preparando...':'Criar loja e abrir configuração completa'}</button>
    </form>}

    {shopId && !link && <>
      <section className="space-y-4 rounded-2xl border border-white/10 p-5">
        <h2 className="text-xl font-semibold text-white">1. Perfil e identidade</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Nome<input value={shopName} onChange={(e)=>setShopName(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3" /></label>
          <label className="text-sm">Ramo<select value={businessType} onChange={(e)=>setBusinessType(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-neutral-800 p-3">{PET_BUSINESS_TYPES.map((t)=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
          <label className="text-sm">Slogan<input value={slogan} onChange={(e)=>setSlogan(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3" /></label>
          <label className="text-sm">Link público<input value={slug} onChange={(e)=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="larabanhoetosa" className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3" /></label>
          <label className="text-sm sm:col-span-2">Descrição<textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3" /></label>
          <label className="text-sm sm:col-span-2">Endereço<input value={address} onChange={(e)=>setAddress(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3" /></label>
          <label className="text-sm">WhatsApp<input value={phone} onChange={(e)=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3" /></label>
          <label className="text-sm">Horário exibido ao cliente<input value={hoursText} onChange={(e)=>setHoursText(e.target.value)} placeholder="Seg–Sex 8h–11h e 13h–18h..." className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3" /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-4">
            <p className="mb-3 font-medium">Logo</p>
            <div className="flex items-center gap-4">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-24 w-24 rounded-xl border border-white/10 object-cover" />}
              <ImageDropzone onFiles={uploadLogo} disabled={busy} className="flex min-h-24 flex-1 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 p-4 text-center text-sm text-brass">{logoUrl?'Trocar logo':'Enviar logo'}</ImageDropzone>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <p className="mb-3 font-medium">Fotos da loja</p>
            <div className="flex flex-wrap gap-2">{photos.map((p,i)=><div key={p.url+i} className="relative"><img src={p.url} alt="" className="h-20 w-20 rounded-lg object-cover"/><button type="button" onClick={()=>setPhotos(v=>v.filter((_,j)=>j!==i))} className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-xs">×</button></div>)}</div>
            <ImageDropzone multiple onFiles={uploadGallery} disabled={busy} className="mt-3 flex min-h-16 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 p-3 text-sm text-brass">Adicionar fotos</ImageDropzone>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-white">2. Serviços e táxi dog</h2><button type="button" onClick={()=>setServices(v=>[...v,blankService()])} className="text-sm text-brass">+ Serviço</button></div>
        {services.map((s,i)=><div key={s.id||i} className="rounded-xl border border-white/10 p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <input placeholder="Serviço" value={s.name} onChange={(e)=>setServices(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2 sm:col-span-2"/>
            <input placeholder="Preço" inputMode="decimal" value={s.price} onChange={(e)=>setServices(v=>v.map((x,j)=>j===i?{...x,price:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
            <input placeholder="Duração (min)" inputMode="numeric" value={s.duration} onChange={(e)=>setServices(v=>v.map((x,j)=>j===i?{...x,duration:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={s.transportEnabled} onChange={(e)=>setServices(v=>v.map((x,j)=>j===i?{...x,transportEnabled:e.target.checked}:x))}/>Táxi dog</label>
            {s.transportEnabled && <>
              <select value={s.transportMode} onChange={(e)=>setServices(v=>v.map((x,j)=>j===i?{...x,transportMode:e.target.value as 'fixed'|'quote'}:x))} className="rounded-lg bg-neutral-800 p-2"><option value="fixed">Taxa fixa</option><option value="quote">Sob consulta</option></select>
              {s.transportMode==='fixed' && <input value={s.transportFee} onChange={(e)=>setServices(v=>v.map((x,j)=>j===i?{...x,transportFee:e.target.value}:x))} placeholder="Taxa" className="w-24 rounded-lg border border-white/15 bg-white/5 p-2"/>}
            </>}
            <button type="button" onClick={()=>setServices(v=>v.filter((_,j)=>j!==i))} className="ml-auto text-red-400">Remover</button>
          </div>
        </div>)}
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-white">3. Equipe e horários</h2><button type="button" onClick={()=>setStaff(v=>[...v,blankStaff()])} className="text-sm text-brass">+ Profissional</button></div>
        {staff.map((p,i)=><div key={p.id||i} className="rounded-xl border border-white/10 p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <input placeholder="Nome" value={p.name} onChange={(e)=>setStaff(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
            <input placeholder="Função" value={p.role} onChange={(e)=>setStaff(v=>v.map((x,j)=>j===i?{...x,role:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
            <input placeholder="Especialidade" value={p.specialty} onChange={(e)=>setStaff(v=>v.map((x,j)=>j===i?{...x,specialty:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
            <input placeholder="Comissão %" inputMode="decimal" value={p.commission} onChange={(e)=>setStaff(v=>v.map((x,j)=>j===i?{...x,commission:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {p.photo_url && <img src={p.photo_url} alt="" className="h-14 w-14 rounded-full object-cover"/>}
            <ImageDropzone onFiles={(files)=>uploadStaffPhoto(i,files)} disabled={busy} className="cursor-pointer rounded-lg border border-dashed border-white/20 px-3 py-2 text-xs text-brass">{p.photo_url?'Trocar foto':'Adicionar foto'}</ImageDropzone>
            <button type="button" onClick={()=>setStaff(v=>v.filter((_,j)=>j!==i))} className="ml-auto text-sm text-red-400">Remover profissional</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-3 text-xs">
            <span className="text-neutral-300">Aplicar horário de segunda a sexta:</span>
            <button type="button" onClick={() => setStaff(v => v.map((person,j) => j!==i ? person : {
              ...person, schedules: person.schedules.map(day => day.day_of_week>=1 && day.day_of_week<=5
                ? {...day,is_active:true,start_time:'11:00',end_time:'18:00'} : day)
            }))} className="rounded-lg border border-brass/40 px-3 py-2 text-brass">Seg–Sex 11:00–18:00</button>
            <span className="text-neutral-500">Depois ajuste cada dia abaixo, inclusive sábado e domingo.</span>
          </div>
          <div className="mt-4 grid gap-2">
            {p.schedules.map((sc,k)=><div key={sc.day_of_week} className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={sc.is_active} onChange={(e)=>setStaff(v=>v.map((x,j)=>j===i?{...x,schedules:x.schedules.map((s,z)=>z===k?{...s,is_active:e.target.checked}:s)}:x))}/>{DAYS.find(([,d])=>d===sc.day_of_week)?.[0]}</label>
              <input type="time" disabled={!sc.is_active} value={sc.start_time} onChange={(e)=>setStaff(v=>v.map((x,j)=>j===i?{...x,schedules:x.schedules.map((s,z)=>z===k?{...s,start_time:e.target.value}:s)}:x))} className="rounded-lg bg-neutral-800 p-2 disabled:opacity-40"/>
              <input type="time" disabled={!sc.is_active} value={sc.end_time} onChange={(e)=>setStaff(v=>v.map((x,j)=>j===i?{...x,schedules:x.schedules.map((s,z)=>z===k?{...s,end_time:e.target.value}:s)}:x))} className="rounded-lg bg-neutral-800 p-2 disabled:opacity-40"/>
            </div>)}
          </div>
        </div>)}
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-white">4. Pacotes</h2><button type="button" onClick={()=>setPackages(v=>[...v,blankPackage()])} className="text-sm text-brass">+ Pacote</button></div>
        {packages.length===0 && <p className="text-sm text-neutral-500">Nenhum pacote. Pode deixar vazio.</p>}
        {packages.map((p,i)=><div key={p.id||i} className="grid gap-2 rounded-xl border border-white/10 p-4 sm:grid-cols-5">
          <input placeholder="Nome" value={p.name} onChange={(e)=>setPackages(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2 sm:col-span-2"/>
          <input placeholder="Sessões" inputMode="numeric" value={p.total_sessions} onChange={(e)=>setPackages(v=>v.map((x,j)=>j===i?{...x,total_sessions:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
          <input placeholder="Preço" inputMode="decimal" value={p.price} onChange={(e)=>setPackages(v=>v.map((x,j)=>j===i?{...x,price:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
          <input placeholder="Validade (dias)" inputMode="numeric" value={p.validity_days} onChange={(e)=>setPackages(v=>v.map((x,j)=>j===i?{...x,validity_days:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
          <textarea placeholder="Descrição" value={p.description} onChange={(e)=>setPackages(v=>v.map((x,j)=>j===i?{...x,description:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2 sm:col-span-4"/>
          <button type="button" onClick={()=>setPackages(v=>v.filter((_,j)=>j!==i))} className="text-sm text-red-400">Remover</button>
        </div>)}
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-white">5. Dias fechados / exceções</h2><button type="button" onClick={()=>setClosures(v=>[...v,{starts_on:'',ends_on:'',label:'Fechado'}])} className="text-sm text-brass">+ Período</button></div>
        {closures.length===0 && <p className="text-sm text-neutral-500">Use para feriados, férias ou dias sem atendimento.</p>}
        {closures.map((c,i)=><div key={c.id||i} className="grid gap-2 rounded-xl border border-white/10 p-4 sm:grid-cols-4">
          <input type="date" value={c.starts_on} onChange={(e)=>setClosures(v=>v.map((x,j)=>j===i?{...x,starts_on:e.target.value}:x))} className="rounded-lg bg-neutral-800 p-2"/>
          <input type="date" value={c.ends_on} onChange={(e)=>setClosures(v=>v.map((x,j)=>j===i?{...x,ends_on:e.target.value}:x))} className="rounded-lg bg-neutral-800 p-2"/>
          <input placeholder="Motivo" value={c.label} onChange={(e)=>setClosures(v=>v.map((x,j)=>j===i?{...x,label:e.target.value}:x))} className="rounded-lg border border-white/15 bg-white/5 p-2"/>
          <button type="button" onClick={()=>setClosures(v=>v.filter((_,j)=>j!==i))} className="text-sm text-red-400">Remover</button>
        </div>)}
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {saved && <p className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">{saved}</p>}

      <div className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-2xl border border-brass/25 bg-charcoal/95 p-3 shadow-2xl backdrop-blur sm:flex-row">
        <button type="button" disabled={busy} onClick={()=>void saveAll()} className="min-h-12 flex-1 rounded-xl border border-brass/40 px-5 font-semibold text-brass disabled:opacity-50">{busy?'Salvando...':'Salvar configuração'}</button>
        <button type="button" disabled={busy} onClick={()=>void finish()} className="min-h-12 flex-1 rounded-xl bg-brass px-5 font-semibold text-charcoal disabled:opacity-50">{busy?'Preparando...':'Salvar tudo e gerar convite'}</button>
      </div>
    </>}

    {link && <div className="space-y-3 rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
      <h2 className="text-xl font-semibold text-white">Loja pronta para entregar</h2>
      <p className="text-sm text-neutral-400">O responsável cria a própria senha. Não peça senha por WhatsApp.</p>
      <button className="rounded-xl bg-brass p-3 font-semibold text-charcoal" onClick={() => navigator.clipboard.writeText(message)}>Copiar mensagem para WhatsApp</button>
      <a className="block text-brass underline" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
    </div>}
  </section>
}
