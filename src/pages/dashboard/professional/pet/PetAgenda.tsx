import { ConfirmReceipt, type ReceiptView } from '../../../../components/public/ConfirmReceipt'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import {
  formatPrice,
  formatDate,
  formatTime,
  formatDuration,
  bookingStatusLabel,
  paymentMethodLabel,
} from '../../../../lib/format'
import { petSizeLabel } from '../../../../lib/pet'
import { CompleteBookingModal } from '../../../../components/CompleteBookingModal'
import { BookingActions, type BookingActionStatus } from '../../../../components/BookingActions'
import { DefaultAvatar } from '../../../../components/MediaUI'
import { EmptyState, InlineError, LoadingBlock } from '../../../../components/EmptyState'
import { userFacingError } from '../../../../lib/userFacingError'
import { ProfessionalTimeOff } from '../../../../components/ProfessionalTimeOff'
import { ShopClosures } from '../../../../components/ShopClosures'
import { localDateIso } from '../../../../lib/booking'
import type { BookingWithDetails, Service } from '../../../../lib/types'

interface Props {
  shopId: string
  barberId?: string
}

type DayFilter = 'today' | 'tomorrow' | 'upcoming'

const PET_BOOKING_SELECT = `
  *,
  barbers(name),
  pets!bookings_pet_id_fkey(id, name, size, photo_url, breed),
  booking_pets(pet_id, pets(id, name, size, photo_url, breed)),
  booking_services(service_id, services(name, price, duration_minutes)),
  booking_custom_field_answers(*)
`

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDateIso(d)
}

export function PetAgenda({ shopId, barberId }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [newStep, setNewStep] = useState(1)
  const [receipt, setReceipt] = useState<ReceiptView | null>(null)
  const [receiptPhone, setReceiptPhone] = useState('')
  const [clients, setClients] = useState<{id:string;name:string;phone:string}[]>([])
  const [petsList, setPetsList] = useState<{id:string;name:string;customer_id:string}[]>([])
  const [teamList, setTeamList] = useState<{id:string;name:string}[]>([])
  const [clientId, setClientId] = useState('')
  const [petId, setPetId] = useState('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [staffId, setStaffId] = useState(barberId || '')
  const [dateValue, setDateValue] = useState(localDateIso())
  const [timeValue, setTimeValue] = useState('')
  const [newError, setNewError] = useState('')
  const [savingNew, setSavingNew] = useState(false)
  const [repeatEvery, setRepeatEvery] = useState(0)
  const [repeatCount, setRepeatCount] = useState(4)
  const [createdCount, setCreatedCount] = useState(1)
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [shopServices, setShopServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [completingBooking, setCompletingBooking] = useState<BookingWithDetails | null>(null)
  const [confirmingTransportBooking, setConfirmingTransportBooking] = useState<BookingWithDetails | null>(null)
  const [confirmationTransportFee, setConfirmationTransportFee] = useState('0,00')
  const [clientSearch, setClientSearch] = useState('')
  const [clientHistory, setClientHistory] = useState<BookingWithDetails[]>([])
  const [searching, setSearching] = useState(false)
  const [actionError, setActionError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [dayFilter, setDayFilter] = useState<DayFilter>('today')
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [showAvailability, setShowAvailability] = useState(false)
  const [editingBooking, setEditingBooking] = useState<BookingWithDetails | null>(null)
  const [extraServiceIds, setExtraServiceIds] = useState<string[]>([])
  const [savingExtras, setSavingExtras] = useState(false)
  const [extraError, setExtraError] = useState('')

  const saveExtraServices = async () => {
    if (!editingBooking || !extraServiceIds.length) return
    const existing = new Set((editingBooking.booking_services || []).map(item => item.service_id))
    const additions = shopServices.filter(service => extraServiceIds.includes(service.id) && !existing.has(service.id))
    if (!additions.length) return
    setSavingExtras(true)
    setExtraError('')
    const addedPrice = additions.reduce((sum, service) => sum + Number(service.price || 0), 0)
    const addedMinutes = additions.reduce((sum, service) => sum + Number(service.duration_minutes || 0), 0)
    const previousServices = (editingBooking.booking_services || []).map(item => item.services).filter(Boolean)
    const baseAmount = editingBooking.services_amount != null
      ? Number(editingBooking.services_amount)
      : previousServices.reduce((sum, service) => sum + Number(service.price || 0), 0)
    const previousTotal = editingBooking.quoted_amount != null
      ? Number(editingBooking.quoted_amount)
      : baseAmount + Number(editingBooking.extras_amount || 0) + Number(editingBooking.pet_transport_fee || 0) - Number(editingBooking.discount_amount || 0)
    const previousMinutes = editingBooking.duration_minutes != null
      ? Number(editingBooking.duration_minutes)
      : previousServices.reduce((sum, service) => sum + Number(service.duration_minutes || 0), 0)

    const { error: insertError } = await supabase.from('booking_services').insert(
      additions.map(service => ({ booking_id: editingBooking.id, service_id: service.id }))
    )
    if (insertError) {
      setExtraError(userFacingError(insertError, 'Não foi possível adicionar os serviços.'))
      setSavingExtras(false)
      return
    }
    const { error: updateError } = await supabase.from('bookings').update({
      services_amount: baseAmount + addedPrice,
      quoted_amount: previousTotal + addedPrice,
      duration_minutes: previousMinutes + addedMinutes,
    }).eq('id', editingBooking.id).eq('shop_id', shopId)
    if (updateError) {
      await supabase.from('booking_services').delete()
        .eq('booking_id', editingBooking.id).in('service_id', additions.map(service => service.id))
      setExtraError(userFacingError(updateError, 'Não foi possível atualizar o agendamento.'))
      setSavingExtras(false)
      return
    }
    setEditingBooking(null)
    setExtraServiceIds([])
    setSavingExtras(false)
    await load()
  }

  const today = addDaysIso(0)
  const tomorrow = addDaysIso(1)

  const petsForBooking = (b: BookingWithDetails) => {
    const fromJoin = (b.booking_pets || [])
      .map((row) => row.pets)
      .filter(Boolean) as NonNullable<BookingWithDetails['pets']>[]
    if (fromJoin.length > 0) return fromJoin
    return b.pets ? [b.pets] : []
  }

  const load = useCallback(async () => {
    setLoadError('')
    let query = supabase
      .from('bookings')
      .select(PET_BOOKING_SELECT)
      .eq('shop_id', shopId)
      .gte('date', addDaysIso(-30))
      .order('date')
      .order('time')
    if (barberId) query = query.eq('barber_id', barberId)

    const [{ data, error }, { data: svc }] = await Promise.all([
      query,
      supabase.from('services').select('*').eq('shop_id', shopId).order('name'),
    ])

    if (error) {
      setLoadError(userFacingError(error, 'Não foi possível carregar a agenda.'))
      setBookings([])
    } else {
      setBookings((data as BookingWithDetails[]) || [])
    }
    setShopServices(svc || [])
    setLoading(false)
  }, [shopId, barberId, today])

  useEffect(() => {
    load()
  }, [load])

  const openNew = async () => {
    const [a,b,d] = await Promise.all([
      supabase.from('shop_customers').select('id,name,phone').eq('shop_id',shopId).order('name'),
      supabase.from('pets').select('id,name,customer_id').eq('shop_id',shopId).order('name'),
      supabase.from('barbers').select('id,name').eq('shop_id',shopId).order('name'),
    ])
    if(a.error||b.error||d.error){setActionError('Erro ao carregar dados para agendar.');return}
    setClients(a.data||[]);setPetsList(b.data||[]);setTeamList(d.data||[]);setNewError('');setNewStep(1);setReceipt(null);setRepeatEvery(0);setRepeatCount(4);setServiceIds([]);setShowNew(true)
  }
  const saveNew = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const client=clients.find(x=>x.id===clientId)
    const pet=petsList.find(x=>x.id===petId&&x.customer_id===clientId)
    const selectedServices=shopServices.filter(x=>serviceIds.includes(x.id))
    const totalDuration=selectedServices.reduce((sum,x)=>sum+Number(x.duration_minutes||60),0)
    const totalPrice=selectedServices.reduce((sum,x)=>sum+Number(x.price||0),0)
    if(!client||!pet||selectedServices.length===0||!staffId||!dateValue||!timeValue){setNewError('Preencha todos os campos.');return}
    if(dateValue<localDateIso()){setNewError('Selecione uma data futura.');return}
    setSavingNew(true);setNewError('')
    const count=repeatEvery===0?1:Math.min(12,Math.max(2,repeatCount))
    const dates=Array.from({length:count},(_,i)=>{
      const [year,month,day]=dateValue.split('-').map(Number)
      const d=new Date(Date.UTC(year,month-1,day+i*repeatEvery))
      return d.toISOString().slice(0,10)
    })
    let completed=0
    for(const bookingDate of dates){
      const {data:busy,error:busyError}=await supabase.from('bookings').select('id,time,duration_minutes,status')
        .eq('shop_id',shopId).eq('barber_id',staffId).eq('date',bookingDate)
        .not('status','in','("cancelled","no_show")')
      if(busyError){setNewError(`Não foi possível conferir os horários. ${completed} agendamento(s) já criado(s).`);setSavingNew(false);return}
      const minutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m}
      const start=minutes(timeValue)
      const duration=totalDuration
      if((busy||[]).some(x=>start<minutes(x.time)+Number(x.duration_minutes||60)&&minutes(x.time)<start+duration)){
        setNewError(`O profissional já tem atendimento em ${formatDate(bookingDate)} às ${formatTime(timeValue)}. ${completed} agendamento(s) já criado(s).`)
        setSavingNew(false);return
      }
      const {data,error}=await supabase.from('bookings').insert({
        shop_id:shopId,barber_id:staffId,service_id:selectedServices[0].id,
        client_name:client.name,client_phone:client.phone,shop_customer_id:client.id,pet_id:pet.id,
        date:bookingDate,time:timeValue,status:'scheduled',duration_minutes:totalDuration,quoted_amount:totalPrice
      }).select('id').single()
      if(error){setNewError(`${userFacingError(error,'Não foi possível agendar.')} ${completed} agendamento(s) já criado(s).`);setSavingNew(false);return}
      completed++
      const linked=await supabase.from('booking_services').insert(selectedServices.map(x=>({booking_id:data.id,service_id:x.id})))
      if(linked.error)setActionError('Atendimento criado, mas houve erro ao vincular o serviço.')
    }
    setCreatedCount(completed)
    setReceipt({
      isPet:true,shopId,shopName:'Pet shop',
      barberName:teamList.find(x=>x.id===staffId)?.name || '',
      date:dateValue,time:timeValue,durationMinutes:totalDuration,
      clientName:client.name,clientPhone:client.phone,
      services:selectedServices.map(x=>({id:x.id,name:x.name,price:Number(x.price||0)})),
      petName:pet.name,
    })
    setReceiptPhone(client.phone)
    setSavingNew(false);setNewStep(4);await load()
  }
  const updateStatus = async (
    bookingId: string,
    status: BookingActionStatus
  ) => {
    setActionError('')
    setStatusUpdatingId(bookingId)
    const { error } = await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_status: status,
    })
    if (error) {
      setActionError(userFacingError(error, 'Não foi possível atualizar o atendimento.'))
      setStatusUpdatingId(null)
      return
    }
    await load()
    setStatusUpdatingId(null)
  }

  const requestStatusChange = (booking: BookingWithDetails, status: BookingActionStatus) => {
    if (status === 'confirmed' && booking.pet_transport_requested) {
      setConfirmationTransportFee(String(Number(booking.pet_transport_fee || 0).toFixed(2)).replace('.', ','))
      setConfirmingTransportBooking(booking)
      return
    }
    updateStatus(booking.id, status)
  }

  const confirmTransportAndBooking = async () => {
    if (!confirmingTransportBooking) return
    const fee = Number(confirmationTransportFee.replace(',', '.'))
    if (!Number.isFinite(fee) || fee < 0) {
      setActionError('Informe um valor válido para o Táxi Pet.')
      return
    }

    const booking = confirmingTransportBooking
    setStatusUpdatingId(booking.id)
    setActionError('')
    const { error } = await supabase.rpc('set_pet_transport_fee', {
      p_booking_id: booking.id,
      p_fee: fee,
    })
    if (error) {
      setActionError(userFacingError(error, 'Não foi possível salvar o valor do Táxi Pet.'))
      setStatusUpdatingId(null)
      return
    }
    setConfirmingTransportBooking(null)
    await updateStatus(booking.id, 'confirmed')
  }

  const searchClientHistory = async () => {
    const query = clientSearch.trim()
    if (!query) return
    setSearching(true)
    const digits = query.replace(/\D/g, '')
    let q = supabase
      .from('bookings')
      .select(PET_BOOKING_SELECT)
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .order('date', { ascending: false })
      .order('time', { ascending: false })

    if (barberId) q = q.eq('barber_id', barberId)

    if (digits.length >= 8) {
      q = q.ilike('client_phone', `%${digits}%`)
    } else {
      q = q.ilike('client_name', `%${query}%`)
    }

    const { data } = await q.limit(50)
    setClientHistory((data as BookingWithDetails[]) || [])
    setSearching(false)
  }

  if (loading) return <LoadingBlock label="Carregando agenda..." />

  const activeBookings = bookings.filter(
    (b) =>
      b.status === 'scheduled' ||
      b.status === 'confirmed' ||
      b.status === 'in_progress' ||
      b.status === 'awaiting_payment' ||
      !b.status
  )
  const filtered =
    dayFilter === 'today'
      ? activeBookings.filter((b) => b.date === today)
      : dayFilter === 'tomorrow'
        ? activeBookings.filter((b) => b.date === tomorrow)
        : activeBookings
  const todayBookings = activeBookings.filter((b) => b.date === today)
  const todayRevenue = todayBookings.reduce(
    (sum, booking) =>
      sum + (booking.quoted_amount != null ? Number(booking.quoted_amount) :
      Array.from(
        new Map((booking.booking_services || []).map((item) => [item.service_id, item.services])).values()
      ).reduce((serviceSum, service) => serviceSum + Number(service?.price || 0), 0)),
    0
  )
  const waitingToday = todayBookings.filter((b) => !['in_progress', 'awaiting_payment'].includes(b.status || '')).length

  return (
    <div className="overflow-x-hidden">
      <div className="mb-4 flex justify-end"><button type="button" onClick={()=>void openNew()} className="min-h-11 rounded-xl bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal-dark">+ Novo agendamento</button></div>
      {showNew && <section className="mb-4 rounded-xl border border-white/10 bg-charcoal-dark p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-white">Novo agendamento</h3><button type="button" onClick={()=>setShowNew(false)} className="text-sm text-charcoal-muted">Fechar</button></div>
        <div className="mb-5 grid grid-cols-4 gap-1.5">{['Cliente e pet','Serviços','Data e hora','Concluído'].map((label,i)=><div key={label} className={`rounded-lg px-1 py-2 text-center text-[11px] font-medium ${newStep===i+1?'bg-brass text-charcoal-dark':'bg-white/5 text-charcoal-muted'}`}>{i+1}. {label}</div>)}</div>
        {newStep===4 && receipt ? <div className="space-y-3">
          {createdCount>1 && <p className="rounded-xl border border-brass/30 p-3 text-center text-sm text-white">{createdCount} agendamentos criados com sucesso. O comprovante abaixo corresponde ao primeiro horário.</p>}
          <ConfirmReceipt view={receipt} signedIn={true}/>
          <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${receiptPhone.replace(/\D/g,'').replace(/^(?!55)/,'55')}?text=${encodeURIComponent(`Oi, ${receipt.clientName}! Seu horário na ${receipt.shopName} está agendado.\nPet: ${receipt.petName}\nServiço: ${receipt.services.map(s=>s.name).join(', ')}\nData: ${formatDate(receipt.date)}\nHorário: ${formatTime(receipt.time)}\nProfissional: ${receipt.barberName || 'A definir'}\nValor: ${formatPrice(receipt.services.reduce((a,s)=>a+s.price,0))}`)}`} className="block rounded-xl bg-brass px-5 py-4 text-center font-semibold text-charcoal-dark">Mandar comprovante pro cliente pelo WhatsApp</a>
          <p className="text-center text-xs text-charcoal-muted">Abre o WhatsApp com os dados do comprovante prontos para enviar.</p>
          <button type="button" onClick={()=>setShowNew(false)} className="w-full rounded-xl border border-white/20 py-3 text-white">Concluir</button>
        </div> : <form onSubmit={e=>{if(newStep<3){e.preventDefault();if(newStep===2&&serviceIds.length===0){setNewError('Selecione pelo menos um serviço.');return}setNewError('');setNewStep(newStep+1)}else void saveNew(e)}} className="space-y-4">
          {newStep===1 && <div className="space-y-4">
            <p className="text-sm text-charcoal-muted">Escolha quem será atendido.</p>
            <label className="grid gap-2 text-sm text-white">Cliente<select required value={clientId} onChange={e=>{setClientId(e.target.value);setPetId('')}} className="min-h-12 rounded-xl bg-charcoal p-3"><option value="">Selecione um cliente</option>{clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm text-white">Pet<select required value={petId} onChange={e=>setPetId(e.target.value)} className="min-h-12 rounded-xl bg-charcoal p-3"><option value="">Selecione o pet</option>{petsList.filter(x=>x.customer_id===clientId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          </div>}
          {newStep===2 && <div className="space-y-4">
            <p className="text-sm text-charcoal-muted">Selecione o serviço e quem vai realizar o atendimento.</p>
            <fieldset className="space-y-2"><legend className="text-sm font-medium text-white">Serviços (selecione um ou mais)</legend>{shopServices.map(x=><label key={x.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-charcoal p-3 text-sm text-white"><input type="checkbox" checked={serviceIds.includes(x.id)} onChange={e=>setServiceIds(current=>e.target.checked?[...current,x.id]:current.filter(id=>id!==x.id))} className="h-4 w-4 accent-amber-500"/><span className="flex-1">{x.name}</span><span className="text-brass">{formatPrice(Number(x.price||0))}</span></label>)}{shopServices.length===0&&<p className="text-xs text-charcoal-muted">Cadastre um serviço antes de agendar.</p>}<p className="text-sm text-brass">Total: {formatPrice(shopServices.filter(x=>serviceIds.includes(x.id)).reduce((sum,x)=>sum+Number(x.price||0),0))}</p></fieldset>
            <label className="grid gap-2 text-sm text-white">Profissional<select required value={staffId} onChange={e=>setStaffId(e.target.value)} className="min-h-12 rounded-xl bg-charcoal p-3"><option value="">Selecione</option>{teamList.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          </div>}
          {newStep===3 && <div className="space-y-4">
            <p className="text-sm text-charcoal-muted">Defina quando o pet será atendido.</p>
            <label className="grid gap-2 text-sm text-white">Data<input type="date" required min={localDateIso()} value={dateValue} onChange={e=>setDateValue(e.target.value)} className="min-h-12 rounded-xl bg-charcoal p-3"/></label>
            <label className="grid gap-2 text-sm text-white">Horário<input type="time" required value={timeValue} onChange={e=>setTimeValue(e.target.value)} className="min-h-12 rounded-xl bg-charcoal p-3"/></label>
            <label className="grid gap-2 text-sm text-white">Repetição<select value={repeatEvery} onChange={e=>setRepeatEvery(Number(e.target.value))} className="min-h-12 rounded-xl bg-charcoal p-3"><option value={0}>Não repetir</option><option value={7}>Toda semana</option><option value={14}>A cada 15 dias (quinzenal)</option></select></label>
            {repeatEvery>0 && <label className="grid gap-2 text-sm text-white">Quantidade de atendimentos (incluindo o primeiro)<select value={repeatCount} onChange={e=>setRepeatCount(Number(e.target.value))} className="min-h-12 rounded-xl bg-charcoal p-3">{Array.from({length:11},(_,i)=>i+2).map(n=><option key={n} value={n}>{n} atendimentos</option>)}</select></label>}
            {repeatEvery>0 && <p className="text-xs text-charcoal-muted">Os horários serão reservados nas próximas {repeatCount} datas. Se houver conflito, a criação para e informa quantos foram salvos.</p>}
            <div className="rounded-xl border border-white/10 p-4 text-sm text-white">Confira: {clients.find(x=>x.id===clientId)?.name} · {petsList.find(x=>x.id===petId)?.name} · {shopServices.filter(x=>serviceIds.includes(x.id)).map(x=>x.name).join(' + ')}</div>
          </div>}
          {newError && <p role="alert" className="text-sm text-red-300">{newError}</p>}
          <div className="flex gap-3">{newStep>1 && <button type="button" onClick={()=>setNewStep(newStep-1)} className="rounded-xl border border-white/20 px-5 py-3 text-white">Voltar</button>}<button type="submit" disabled={savingNew} className="flex-1 rounded-xl bg-brass px-5 py-3 font-semibold text-charcoal-dark disabled:opacity-50">{savingNew?'Salvando...':newStep===3?'Confirmar agendamento':'Continuar'}</button></div>
        </form>}
      </section>}
      <header className="mb-6 rounded-2xl border border-charcoal-light bg-gradient-to-br from-charcoal-dark via-charcoal-dark to-brass/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brass">Operação do dia</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {barberId ? 'Minha agenda' : 'Agenda da equipe'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-charcoal-muted">
              Horários, pets, serviços e andamento reunidos em uma visão simples para a equipe.
            </p>
          </div>
          <button type="button" onClick={() => setShowAvailability((current) => !current)} className="min-h-11 rounded-xl border border-brass/35 bg-brass/5 px-4 text-sm font-medium text-brass transition hover:bg-brass/10">
            {showAvailability ? 'Fechar configurações' : barberId ? 'Configurar folgas' : 'Folgas e feriados'}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-black/15 p-3">
            <p className="text-xs text-charcoal-muted">Atendimentos hoje</p>
            <p className="mt-1 text-2xl font-semibold text-white">{todayBookings.length}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/15 p-3">
            <p className="text-xs text-charcoal-muted">Aguardando</p>
            <p className="mt-1 text-2xl font-semibold text-white">{waitingToday}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/15 p-3">
            <p className="text-xs text-charcoal-muted">Em atendimento</p>
            <p className="mt-1 text-2xl font-semibold text-white">{todayBookings.filter((b) => b.status === 'in_progress').length}</p>
          </div>
          <div className="rounded-xl border border-brass/20 bg-brass/5 p-3">
            <p className="text-xs text-brass/80">Previsto hoje</p>
            <p className="mt-1 font-mono text-xl text-brass">{formatPrice(todayRevenue)}</p>
          </div>
        </div>
      </header>

      {showAvailability ? (
        <div className="mb-6 space-y-4">
          {!barberId ? <ShopClosures shopId={shopId} /> : null}
          <ProfessionalTimeOff shopId={shopId} barberId={barberId} />
        </div>
      ) : null}
      {(actionError || loadError) && (
        <div className="mb-4">
          <InlineError message={actionError || loadError} />
        </div>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {([['today', 'Hoje'], ['tomorrow', 'Amanhã'], ['upcoming', 'Próximos']] as const).map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDayFilter(key)}
              className={`shrink-0 rounded-lg px-4 py-2.5 text-sm min-h-[44px] ${
                dayFilter === key
                  ? 'bg-brass text-charcoal font-semibold'
                  : 'border border-charcoal-light text-charcoal-muted'
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      <details className="group mb-8 rounded-2xl border border-charcoal-light bg-charcoal-dark/30 p-4">
        <summary className="cursor-pointer list-none font-medium text-white">
          <span className="flex items-center justify-between">Histórico do cliente ou pet <span className="text-xs font-normal text-brass group-open:hidden">Abrir busca</span></span>
        </summary>
        <div className="mt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchClientHistory()}
            placeholder="Buscar por nome ou telefone"
            className="w-full flex-1 rounded-lg border border-charcoal-light bg-charcoal px-4 py-2.5 text-white focus:border-brass focus:outline-none min-h-[44px]"
          />
          <button
            type="button"
            onClick={searchClientHistory}
            disabled={searching}
            className="rounded-lg bg-brass px-4 py-2.5 font-semibold text-charcoal disabled:opacity-50 min-h-[44px]"
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {clientHistory.length > 0 && (
          <div className="mt-4 space-y-3">
            {clientHistory.map((b) => {
              const services = (b.booking_services || []).map((bs) => bs.services)
              const total = b.quoted_amount != null ? Number(b.quoted_amount) : services.reduce((sum, s) => sum + Number(s?.price || 0), 0)
              const petList = petsForBooking(b)
              const petLabel = petList.map((p) => p.name).join(' · ')
              return (
                <div key={b.id} className="rounded-lg bg-charcoal-light/30 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white">
                      {petLabel ? `${petLabel} · ${b.client_name}` : b.client_name}
                    </span>
                    <span className="font-mono text-brass">{formatPrice(total)}</span>
                  </div>
                  <p className="text-charcoal-muted">
                    {formatDate(b.date)} · {formatTime(b.time)} · {b.barbers?.name} ·{' '}
                    {paymentMethodLabel(b.payment_method)}
                  </p>
                  <p className="text-white">{services.map((s) => s.name).join(' · ')}</p>
                  {b.notes && <p className="text-charcoal-muted mt-1">Obs: {b.notes}</p>}
                </div>
              )
            })}
          </div>
        )}
        </div>
      </details>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento neste período."
          description="Quando houver reservas, elas aparecem aqui com pet, horário e serviço."
        />
      ) : (
        <div className="relative space-y-3 before:absolute before:bottom-6 before:left-[4.65rem] before:top-6 before:w-px before:bg-charcoal-light sm:before:left-[5.65rem]">
          {filtered.map((b) => {
            const services = Array.from(
              new Map(
                (b.booking_services || []).map((bs) => [bs.service_id, bs.services])
              ).values()
            )
            const total = b.quoted_amount != null ? Number(b.quoted_amount) : services.reduce((sum, s) => sum + Number(s?.price || 0), 0)
            const status = b.status || 'scheduled'
            const duration =
              b.duration_minutes ||
              services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
            const petList = petsForBooking(b)
            const mainPet = petList[0]
            return (
              <article key={b.id} className="relative ml-20 rounded-2xl border border-charcoal-light bg-charcoal-dark/35 p-4 transition hover:border-brass/30 sm:ml-24">
                <div className="absolute -left-20 top-5 w-16 text-right sm:-left-24 sm:w-20">
                  <p className="font-mono text-base text-brass">{formatTime(b.time)}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-charcoal-muted">{formatDate(b.date)}</p>
                </div>
                <span className="absolute -left-[0.41rem] top-7 h-3 w-3 rounded-full border-2 border-charcoal bg-brass shadow-[0_0_0_4px_rgba(214,163,61,0.12)]" />
                <div className="flex flex-wrap justify-between gap-3">
                  <div className="flex gap-3">
                    {mainPet?.photo_url ? (
                      <img
                        src={mainPet.photo_url}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover"
                      />
                    ) : mainPet ? (
                      <DefaultAvatar
                        name={mainPet.name}
                        className="h-14 w-14 rounded-xl text-lg"
                      />
                    ) : null}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-brass">{b.barbers?.name || 'Profissional'}</p>
                      {duration > 0 && (
                        <p className="text-xs text-charcoal-muted mt-1">
                          {formatDuration(duration)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-charcoal-light px-2 py-0.5 text-xs text-charcoal-muted mb-1">
                      {bookingStatusLabel(status)}
                    </span>
                    {petList.length > 0 ? (
                      <>
                        <p className="font-medium text-white text-lg">
                          {petList.map((p) => p.name).join(' · ')}
                        </p>
                        <p className="text-sm text-charcoal-muted">
                          {petList
                            .map((p) => `${p.breed || 'Pet'} · ${petSizeLabel(p.size)}`)
                            .join(' · ')}
                        </p>
                        <p className="text-sm text-white mt-1">Cliente: {b.client_name}</p>
                        <p className="text-sm text-charcoal-muted">{b.client_phone}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-white">{b.client_name}</p>
                        <p className="text-sm text-charcoal-muted">{b.client_phone}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-charcoal-light pt-3">
                  <div>
                  <p className="text-sm text-white">
                      {services.map((s) => s.name).join(' · ') || 'Serviço'}
                    </p>
                    {b.notes && (
                      <p className="text-sm text-brass mt-1">Obs: {b.notes}</p>
                    )}
                    {b.pet_transport_requested && <p className="mt-1 text-sm font-medium text-brass">Táxi Pet · {Number(b.pet_transport_fee || 0) > 0 ? formatPrice(Number(b.pet_transport_fee)) : 'valor a definir'} · buscar em {b.pet_transport_address}</p>}
                  </div>
                  <p className="font-mono text-brass">{formatPrice(total)}</p>
                </div>
          <button type="button" onClick={() => { setEditingBooking(b); setExtraServiceIds([]); setExtraError('') }}
            className="min-h-11 rounded-xl border border-brass/40 px-4 py-2.5 text-sm font-medium text-brass hover:bg-brass/10">
            + Adicionar serviços
          </button>
                <BookingActions
                  compact
            compact
                  status={b.status}
                  busy={statusUpdatingId === b.id}
                  includeAwaitingPayment
                  onStatusChange={(nextStatus) => requestStatusChange(b, nextStatus)}
                  onComplete={() => setCompletingBooking(b)}
                  className="mt-4"
                />
              </article>
            )
          })}
        </div>
      )}


      {editingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Adicionar serviços">
          <div className="w-full max-w-md rounded-2xl border border-brass/25 bg-charcoal-dark p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-lg font-semibold text-white">Adicionar serviços</h3>
                <p className="mt-1 text-sm text-charcoal-muted">{editingBooking.client_name} · {formatDate(editingBooking.date)}</p></div>
              <button type="button" onClick={() => setEditingBooking(null)} className="rounded-lg px-3 py-2 text-sm text-charcoal-muted">Fechar</button>
            </div>
            <div className="mt-5 max-h-72 space-y-2 overflow-y-auto">
              {shopServices.filter(service => !(editingBooking.booking_services || []).some(item => item.service_id === service.id)).map(service => (
                <label key={service.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 text-sm text-white">
                  <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={extraServiceIds.includes(service.id)}
                    onChange={event => setExtraServiceIds(current => event.target.checked ? [...current, service.id] : current.filter(id => id !== service.id))} />
                  <span className="flex-1">{service.name}</span><span className="text-brass">{formatPrice(Number(service.price || 0))}</span>
                </label>
              ))}
            </div>
            {extraError && <p role="alert" className="mt-3 text-sm text-red-400">{extraError}</p>}
            <button type="button" disabled={!extraServiceIds.length || savingExtras} onClick={() => void saveExtraServices()}
              className="mt-5 min-h-12 w-full rounded-xl bg-brass px-4 py-3 text-center font-semibold text-charcoal disabled:opacity-50">
              {savingExtras ? 'Salvando...' : 'Salvar serviços'}
            </button>
          </div>
        </div>
      )}
      {completingBooking && (
        <CompleteBookingModal
          booking={completingBooking}
          shopServices={shopServices}
          onClose={() => setCompletingBooking(null)}
          onComplete={() => {
            setCompletingBooking(null)
            load()
          }}
        />
      )}

      {confirmingTransportBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="transport-confirm-title">
          <div className="w-full max-w-md rounded-2xl border border-brass/30 bg-charcoal p-5 shadow-2xl sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">Confirmar rota</p>
            <h3 id="transport-confirm-title" className="mt-1 text-xl font-semibold text-white">Táxi Dog / Táxi Pet</h3>
            <p className="mt-2 text-sm leading-6 text-charcoal-muted">Revise o local da busca e informe o valor combinado antes de confirmar o agendamento.</p>
            <div className="mt-4 rounded-xl border border-charcoal-light bg-charcoal-dark/50 p-4 text-sm">
              <p className="font-medium text-white">{confirmingTransportBooking.pet_transport_address}</p>
              {confirmingTransportBooking.pet_transport_notes ? <p className="mt-1 text-charcoal-muted">{confirmingTransportBooking.pet_transport_notes}</p> : null}
            </div>
            <label className="mt-4 block text-sm font-medium text-white">Valor do transporte (R$)<input autoFocus type="text" inputMode="decimal" value={confirmationTransportFee} onChange={(event) => setConfirmationTransportFee(event.target.value.replace(/[^0-9,.]/g, ''))} placeholder="0,00" className="mt-1.5 min-h-11 w-full rounded-xl border border-charcoal-light bg-charcoal-dark px-3 text-white outline-none focus:border-brass" /></label>
            <p className="mt-2 text-xs text-charcoal-muted">Use 0,00 quando a busca for gratuita. O valor será somado ao total do agendamento.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setConfirmingTransportBooking(null)} disabled={statusUpdatingId === confirmingTransportBooking.id} className="min-h-11 flex-1 rounded-xl border border-charcoal-light px-4 text-sm text-charcoal-muted hover:text-white disabled:opacity-50">Voltar</button>
              <button type="button" onClick={confirmTransportAndBooking} disabled={statusUpdatingId === confirmingTransportBooking.id} className="min-h-11 flex-1 rounded-xl bg-brass px-4 text-sm font-semibold text-charcoal disabled:opacity-50">{statusUpdatingId === confirmingTransportBooking.id ? 'Confirmando...' : 'Salvar e confirmar'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
