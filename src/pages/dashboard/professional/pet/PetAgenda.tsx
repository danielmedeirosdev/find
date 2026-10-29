import { HistoricalBooking } from '../../../../components/HistoricalBooking'
import { AgendaManagement } from '../../../../components/AgendaManagement'
import { BookingConfirmationReminder } from '../../../../components/BookingConfirmationReminder'
import { applyWeekdayDiscount, petTransportFee } from '../../../../lib/servicePricing'
import { Modal } from '../../../../components/Modal'
import { ConfirmReceipt, type ReceiptView } from '../../../../components/public/ConfirmReceipt'
import { useCallback, useEffect, useState, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import {
  formatPrice,
  customerLabel,
  formatDate,
  formatTime,
  formatDuration,
  bookingStatusLabel,
  paymentMethodLabel,
} from '../../../../lib/format'
import { getPetServicesDuration, getPetServicesPrice, petSizeLabel } from '../../../../lib/pet'
import { CompleteBookingModal } from '../../../../components/CompleteBookingModal'
import { BookingActions, type BookingActionStatus } from '../../../../components/BookingActions'
import { DefaultAvatar } from '../../../../components/MediaUI'
import { EmptyState, InlineError, LoadingBlock } from '../../../../components/EmptyState'
import { userFacingError } from '../../../../lib/userFacingError'
import { ProfessionalTimeOff } from '../../../../components/ProfessionalTimeOff'
import { ShopClosures } from '../../../../components/ShopClosures'
import { bookingTotal } from '../../../../lib/finance'
import { loadBookingAvailability, availableBookingTimes, eligibleProfessionals, localDateIso } from '../../../../lib/booking'
import { BookingSchedulePicker } from '../../../../components/BookingSchedulePicker'
import { BookingServicePicker } from '../../../../components/BookingServicePicker'
import { BookingTransportFields } from '../../../../components/BookingTransportFields'
import { BookingCustomerPicker } from '../../../../components/BookingCustomerPicker'
import { BookingStepper } from '../../../../components/public/BookingStepper'
import type { BookingWithDetails, Service, ServiceSizeRule, PetSize, ServiceWeekdayDiscount, ServicePetTransport, Booking } from '../../../../lib/types'

interface Props {
  shopId: string
  shopName: string
  barberId?: string
  pendingReminderIds?: string[]
  focusBookingId?: string
  onReminderUpdate?: () => void
}

type DayFilter = 'today' | 'tomorrow' | 'upcoming' | 'date'

const PET_BOOKING_SELECT = `
  *,
  barbers(name),
  shop_customers(name,phone),
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

export function PetAgenda({ shopId, shopName, barberId, pendingReminderIds = [], focusBookingId, onReminderUpdate }: Props) {
  const focusedBooking=useRef('')
  const loadRequest=useRef(0)
  const [showNew, setShowNew] = useState(false)
  const [newStep, setNewStep] = useState(1)
  const [receipt, setReceipt] = useState<ReceiptView | null>(null)
  const [receiptPhone, setReceiptPhone] = useState('')
  const [clients, setClients] = useState<{id:string;name:string;phone:string}[]>([])
  const [petsList, setPetsList] = useState<{id:string;name:string;customer_id:string;size:PetSize}[]>([])
  const [teamList, setTeamList] = useState<{id:string;name:string}[]>([])
  const [clientId, setClientId] = useState('')
  const [petId, setPetId] = useState('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [staffId, setStaffId] = useState(barberId || '')
  const [dateValue, setDateValue] = useState(localDateIso())
  const [timeValue, setTimeValue] = useState('')
  const [scheduleValid, setScheduleValid] = useState(false)
  const [newError, setNewError] = useState('')
  const [savingNew, setSavingNew] = useState(false)
  const [newNotes,setNewNotes] = useState('')
  const [transportSettings,setTransportSettings] = useState<ServicePetTransport[]>([])
  const [newTransport,setNewTransport] = useState(false)
  const [newAddress,setNewAddress] = useState('')
  const [newTransportNotes,setNewTransportNotes] = useState('')
  const [newTransportFee,setNewTransportFee] = useState('')
  const [repeatEvery, setRepeatEvery] = useState(0)
  const [repeatCount, setRepeatCount] = useState(4)
  const [createdCount, setCreatedCount] = useState(1)
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [shopServices, setShopServices] = useState<Service[]>([])
  const [sizeRules,setSizeRules]=useState<ServiceSizeRule[]>([])
  const [weekdayDiscounts,setWeekdayDiscounts]=useState<ServiceWeekdayDiscount[]>([])
  const servicePrice=(service:Service,size:PetSize,date:string)=>Math.round(applyWeekdayDiscount(getPetServicesPrice([service],size,sizeRules),service.id,date,weekdayDiscounts)*100)/100
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
  const [consultationDate, setConsultationDate] = useState(localDateIso())
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [showAvailability, setShowAvailability] = useState(false)
  const [editingBooking, setEditingBooking] = useState<BookingWithDetails | null>(null)
  const [extraServiceIds, setExtraServiceIds] = useState<string[]>([])
  const [savingExtras, setSavingExtras] = useState(false)
  const [extraError, setExtraError] = useState('')
  const [reservedMinutes,setReservedMinutes] = useState('60')
  const [editStaffId,setEditStaffId] = useState('')
  const [editDate,setEditDate] = useState('')
  const [editTime,setEditTime] = useState('')
  const [editNotes,setEditNotes] = useState('')
  const [editScheduleValid,setEditScheduleValid] = useState(false)

  const selectedTransport = transportSettings.filter(setting=>setting.enabled && serviceIds.includes(setting.service_id))
  const transportAvailable = selectedTransport.length>0
  const transportFeeOverride = newTransportFee.trim()==='' ? null : Number(newTransportFee.replace(',','.'))
  const transportFeeValid = transportFeeOverride===null || (Number.isFinite(transportFeeOverride) && transportFeeOverride>=0 && transportFeeOverride<=999999.99)
  const transportPending = newTransport && transportFeeOverride===null && selectedTransport.some(setting=>setting.pricing_mode==='quote')
  const taxiFee = newTransport && transportFeeValid ? transportFeeOverride ?? petTransportFee(new Set(serviceIds),transportSettings) : 0
  const validateDetails = () => {
    if(newTransport && newAddress.trim().length<5){setNewError('Informe o endereço onde o pet será buscado.');return false}
    if(newTransport && !transportFeeValid){setNewError('Informe um valor válido para o Táxi Pet.');return false}
    return true
  }

  const saveExtraServices = async () => {
    if (!editingBooking || savingExtras) return
    if (!Number.isInteger(Number(reservedMinutes)) || Number(reservedMinutes)<1 || Number(reservedMinutes)>720) {setExtraError('Informe de 1 a 720 minutos.');return}
    if (!['in_progress','awaiting_payment'].includes(editingBooking.status || '') && !editScheduleValid) { setExtraError('Escolha um horário disponível.'); return }
    setSavingExtras(true)
    setExtraError('')
    const ids = [...new Set([...(editingBooking.booking_services || []).map(s => s.service_id), ...extraServiceIds])]
    const { error } = await supabase.rpc('edit_booking_reservation', {
      p_barber_id: editStaffId, p_reserved_minutes: Number(reservedMinutes),
      p_booking_id: editingBooking.id, p_service_ids: ids,
      p_date: editDate, p_time: editTime, p_notes: editNotes,
    })
    if(error) {setExtraError(userFacingError(error,'Não foi possível salvar o atendimento.'));setSavingExtras(false);return}
    setEditingBooking(null)
    setExtraServiceIds([])
    setSavingExtras(false)
    await load()
  }

  const today = addDaysIso(0)
  const tomorrow = addDaysIso(1)
  const selectedDay = dayFilter === 'today' ? today : dayFilter === 'tomorrow' ? tomorrow : consultationDate
  const chooseDay = (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    setConsultationDate(date)
    setDayFilter('date')
  }
  const moveDay = (offset: number) => {
    const date = new Date(`${selectedDay}T12:00:00`)
    date.setDate(date.getDate() + offset)
    chooseDay(localDateIso(date))
  }

  const petsForBooking = (b: BookingWithDetails) => {
    const fromJoin = (b.booking_pets || [])
      .map((row) => row.pets)
      .filter(Boolean) as NonNullable<BookingWithDetails['pets']>[]
    if (fromJoin.length > 0) return fromJoin
    return b.pets ? [b.pets] : []
  }

  const load = useCallback(async () => {
    const request = ++loadRequest.current
    setLoading(true)
    setLoadError('')
    let query = supabase
      .from('bookings')
      .select(PET_BOOKING_SELECT)
      .eq('shop_id', shopId)
      .is('archived_at',null)
      .order('date')
      .order('time')
    query = dayFilter === 'upcoming' ? query.gte('date', today) : query.eq('date', selectedDay)
    if (barberId) query = query.eq('barber_id', barberId)

    const [{ data, error }, { data: svc }, {data: team, error: teamError}] = await Promise.all([
      query,
      supabase.from('services').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('barbers').select('id,name').eq('shop_id',shopId).order('name'),
    ])

    if (request !== loadRequest.current) return
    if (error) {
      setLoadError(userFacingError(error, 'Não foi possível carregar a agenda.'))
      setBookings([])
    } else {
      setBookings((data as BookingWithDetails[]) || [])
    }
    setTeamList(team || [])
    if(teamError) setLoadError('Não foi possível carregar os profissionais. Tente novamente.')
    setShopServices(svc || [])
    if(svc?.length){
      const [rules,discounts,transport]=await Promise.all([
        supabase.from('service_size_rules').select('*').in('service_id',svc.map(s=>s.id)),
        supabase.from('service_weekday_discounts').select('*').in('service_id',svc.map(s=>s.id)),
        supabase.from('service_pet_transport').select('*').eq('shop_id',shopId).in('service_id',svc.map(s=>s.id)),
      ])
      if (request !== loadRequest.current) return
      setSizeRules(rules.data||[]);setWeekdayDiscounts(discounts.data||[]);setTransportSettings(transport.data||[])
      if(rules.error||discounts.error||transport.error)setLoadError('Não foi possível carregar as regras de preços e transporte. Atualize a agenda.')
    }
    setLoading(false)
  }, [shopId, barberId, today, dayFilter, selectedDay])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!focusBookingId) return
    let active = true
    let query = supabase.from('bookings').select('date').eq('id', focusBookingId).eq('shop_id', shopId)
    if (barberId) query = query.eq('barber_id', barberId)
    void query.maybeSingle().then(({ data, error }) => {
      if (!active) return
      if (error) { setActionError('Não foi possível localizar o atendimento do aviso.'); return }
      if (data) { setConsultationDate(data.date); setDayFilter('date') }
    })
    return () => { active = false }
  }, [focusBookingId, shopId, barberId])
  useEffect(()=>{
    if(!focusBookingId || loading || dayFilter!=='date' || focusedBooking.current===focusBookingId)return
    const target=document.getElementById(`booking-${focusBookingId}`)
    if(target){target.scrollIntoView({block:'center',behavior:'smooth'});target.focus({preventScroll:true});focusedBooking.current=focusBookingId}
  },[focusBookingId,loading,dayFilter,bookings])

  const openNew = async () => {
    if(loadError){setActionError(loadError);return}
    const [a,b,d] = await Promise.all([
      supabase.from('shop_customers').select('id,name,phone').eq('shop_id',shopId).order('name'),
      supabase.from('pets').select('id,name,customer_id,size').eq('shop_id',shopId).order('name'),
      supabase.from('barbers').select('id,name').eq('shop_id',shopId).order('name'),
    ])
    if(a.error||b.error||d.error){setActionError('Erro ao carregar dados para agendar.');return}
    setClients(a.data||[]);setPetsList(b.data||[]);setTeamList(d.data||[]);setNewError('');setNewStep(1);setReceipt(null);setRepeatEvery(0);setRepeatCount(4);setServiceIds([]);setNewNotes('');setNewTransport(false);setNewAddress('');setNewTransportNotes('');setNewTransportFee('');setClientId('');setPetId('');setTimeValue('');setDateValue('');setScheduleValid(false);setStaffId(barberId||d.data?.[0]?.id||'');setShowNew(true)
  }
  const saveNew = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const client=clients.find(x=>x.id===clientId)
    const pet=petsList.find(x=>x.id===petId&&x.customer_id===clientId)
    const selectedServices=shopServices.filter(x=>serviceIds.includes(x.id))
    const totalDuration=getPetServicesDuration(selectedServices,pet?.size||'medio',sizeRules)
    if(!client||!pet||selectedServices.length===0||!staffId||!dateValue||!timeValue){setNewError('Preencha todos os campos.');return}
    if(!validateDetails())return
    if(savingNew || !scheduleValid){setNewError('Escolha um horário disponível.');return}
    setSavingNew(true);setNewError('')
    const count=repeatEvery===0?1:Math.min(12,Math.max(2,repeatCount))
    const dates=Array.from({length:count},(_,i)=>{
      const [year,month,day]=dateValue.split('-').map(Number)
      const d=new Date(Date.UTC(year,month-1,day+i*repeatEvery))
      return d.toISOString().slice(0,10)
    })
    let completed=0
    let firstBooking: Booking | null = null
    let availability
    try { availability = await loadBookingAvailability(shopId, [staffId]) }
    catch (error) { setNewError(userFacingError(error,'Não foi possível conferir os horários.')); setSavingNew(false); return }
    if (!eligibleProfessionals(teamList, serviceIds, availability.mappings).some(staff => staff.id === staffId)) {
      setNewError('O profissional não atende essa combinação de serviços.'); setSavingNew(false); return
    }
    // Validate every occurrence before creating the first one. The server also
    // checks each reservation inside its transaction to handle simultaneous use.
    const unavailableDate = dates.find(date => !availableBookingTimes(availability, staffId, date, totalDuration).includes(timeValue))
    if (unavailableDate) { setNewError(`Não há disponibilidade em ${formatDate(unavailableDate)} às ${formatTime(timeValue)}. Nenhum agendamento foi criado.`); setTimeValue(''); setScheduleValid(false); setSavingNew(false); return }
    for(const bookingDate of dates){
      const {data:created,error}=await supabase.rpc('create_operational_booking_with_details', {
        p_shop_id:shopId,p_barber_id:staffId,p_customer_id:client.id,p_pet_id:pet.id,
        p_date:bookingDate,p_time:timeValue,p_service_ids:selectedServices.map(s=>s.id),
        p_notes:newNotes.trim()||null,p_pet_transport:newTransport,
        p_transport_address:newTransport?newAddress.trim():null,
        p_transport_notes:newTransport?newTransportNotes.trim():null,
        p_transport_fee:newTransport?transportFeeOverride:null,
      })
      if(error){setNewError(`${userFacingError(error,'Não foi possível agendar.')} ${completed} agendamento(s) já criado(s).`);setSavingNew(false);await load();return}
      if(!firstBooking)firstBooking=created as Booking
      completed++
    }
    setCreatedCount(completed)
    setReceipt({
      isPet:true,shopId,shopName,
      barberName:teamList.find(x=>x.id===staffId)?.name || '',
      date:dateValue,time:timeValue,durationMinutes:totalDuration,
      clientName:client.name,clientPhone:client.phone,
      notes:firstBooking?.notes,quotedAmount:firstBooking?.quoted_amount,
      petTransportRequested:firstBooking?.pet_transport_requested,petTransportFee:Number(firstBooking?.pet_transport_fee||0),
      petTransportAddress:firstBooking?.pet_transport_address,petTransportNotes:firstBooking?.pet_transport_notes,
      services:selectedServices.map(x=>({id:x.id,name:x.name,price:servicePrice(x,pet.size,dateValue)})),
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

    const { data, error } = await q.limit(50)
    if(error) setActionError('Não foi possível pesquisar o histórico.')
    setClientHistory((data as BookingWithDetails[]) || [])
    setSearching(false)
  }


  const activeBookings = bookings.filter(
    (b) =>
      b.status === 'scheduled' ||
      b.status === 'confirmed' ||
      b.status === 'in_progress' ||
      b.status === 'awaiting_payment' ||
      !b.status
  )
  const filtered = dayFilter === 'upcoming'
    ? activeBookings.filter((b) => b.date >= today)
    : bookings.filter((b) => b.date === selectedDay)

  return (
    <div className="overflow-x-hidden">
      <div className="mb-5 flex justify-stretch sm:justify-end"><button type="button" onClick={()=>void openNew()} className="min-h-12 w-full rounded-xl bg-brass px-5 py-3 text-sm font-semibold text-charcoal-dark shadow-[0_8px_24px_rgba(0,0,0,0.2)] sm:w-auto">+ Novo agendamento</button></div>
      {showNew && <section className="mb-4 rounded-xl border border-white/10 bg-charcoal-dark p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-white">Novo agendamento</h3><button type="button" onClick={()=>setShowNew(false)} className="text-sm text-charcoal-muted">Fechar</button></div>
        <BookingStepper steps={['Cliente e pet','Serviços','Horário','Concluído'].map((label,i)=>({n:i+1,label}))} current={newStep} tone="dark"/>
        {newStep===4 && receipt ? <div className="space-y-3">
          {createdCount>1 && <p className="rounded-xl border border-brass/30 p-3 text-center text-sm text-white">{createdCount} agendamentos criados com sucesso. O comprovante abaixo corresponde ao primeiro horário.</p>}
          <ConfirmReceipt view={receipt} signedIn={true}/>
          <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${receiptPhone.replace(/\D/g,'').replace(/^(?!55)/,'55')}?text=${encodeURIComponent(`${receipt.clientName?.trim()?`Oi, ${receipt.clientName}!`:'Oi!'} Seu horário na ${receipt.shopName} está agendado.\nPet: ${receipt.petName}\nServiço: ${receipt.services.map(s=>s.name).join(', ')}\nData: ${formatDate(receipt.date)}\nHorário: ${formatTime(receipt.time)}\nProfissional: ${receipt.barberName || 'A definir'}\nValor: ${formatPrice(Number(receipt.quotedAmount ?? receipt.services.reduce((a,s)=>a+s.price,0)))}${receipt.notes?`\nObservação: ${receipt.notes}`:''}${receipt.petTransportRequested?`\nTáxi Pet: ${Number(receipt.petTransportFee)>0?formatPrice(Number(receipt.petTransportFee)):'valor a confirmar'}\nEndereço da busca: ${receipt.petTransportAddress}${receipt.petTransportNotes?`\nInstruções: ${receipt.petTransportNotes}`:''}`:''}`)}`} className="block rounded-xl bg-brass px-5 py-4 text-center font-semibold text-charcoal-dark">Mandar comprovante pro cliente pelo WhatsApp</a>
          <p className="text-center text-xs text-charcoal-muted">Abre o WhatsApp com os dados do comprovante prontos para enviar.</p>
          <button type="button" onClick={()=>setShowNew(false)} className="w-full rounded-xl border border-white/20 py-3 text-white">Concluir</button>
        </div> : <form onSubmit={e=>{if(newStep<3){e.preventDefault();if(newStep===2&&serviceIds.length===0){setNewError('Selecione pelo menos um serviço.');return}if(newStep===2&&!validateDetails())return;setNewError('');setNewStep(newStep+1)}else void saveNew(e)}} className="space-y-4">
          {newStep===1 && <div className="space-y-4">
            <BookingCustomerPicker shopId={shopId} clients={clients} pets={petsList} clientId={clientId} petId={petId}
              onSelection={(customer,pet)=>{if(customer!==clientId){setNewNotes('');setNewTransport(false);setNewAddress('');setNewTransportNotes('');setNewTransportFee('')}setClientId(customer);setPetId(pet)}}
              onCustomer={customer=>setClients(current=>current.some(item=>item.id===customer.id)?current.map(item=>item.id===customer.id?customer:item):[...current,customer])}
              onPet={pet=>setPetsList(current=>[...current.filter(item=>item.id!==pet.id),pet])}
            />
          </div>}
          {newStep===2 && <div className="space-y-4">
            <p className="text-sm text-charcoal-muted">Selecione os serviços para {petsList.find(p=>p.id===petId)?.name}.</p>
            <BookingServicePicker
              tone="dark"
              services={shopServices.filter(service=>service.is_active!==false).map(service=>({ id:service.id,name:service.name,price:servicePrice(service,petsList.find(p=>p.id===petId)?.size||'medio',dateValue),duration:getPetServicesDuration([service],petsList.find(p=>p.id===petId)?.size||'medio',sizeRules) }))}
              selectedIds={serviceIds}
              onToggle={id=>{setServiceIds(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);setTimeValue('');setScheduleValid(false);setNewTransport(false);setNewTransportFee('')}}
            />
            <p className="text-sm text-brass">Serviços: {formatPrice(shopServices.filter(x=>serviceIds.includes(x.id)).reduce((sum,x)=>sum+servicePrice(x,petsList.find(p=>p.id===petId)?.size||'medio',dateValue),0))}</p>
            <label className="grid gap-2 text-sm text-white">Observação do atendimento (opcional)<textarea value={newNotes} onChange={e=>setNewNotes(e.target.value)} maxLength={1000} rows={3} placeholder="Cuidados, alergias ou orientações para este atendimento" className="w-full rounded-xl bg-charcoal p-3"/></label>
            {transportAvailable && <BookingTransportFields enabled={newTransport} onEnabled={setNewTransport} pending={selectedTransport.some(item=>item.pricing_mode==='quote') && transportFeeOverride===null} fee={transportFeeValid ? transportFeeOverride ?? petTransportFee(new Set(serviceIds),transportSettings) : 0} address={newAddress} onAddress={setNewAddress} notes={newTransportNotes} onNotes={setNewTransportNotes} feeError={newTransport && !transportFeeValid ? 'Informe um valor válido para o Táxi Pet.' : undefined} feeInput={newTransportFee} onFeeInput={setNewTransportFee} tone="dark"/>}
          </div>}
          {newStep===3 && <div className="space-y-4">
            <BookingSchedulePicker
              shopId={shopId}
              professionals={barberId?teamList.filter(staff=>staff.id===barberId):teamList}
              serviceIds={serviceIds}
              duration={getPetServicesDuration(shopServices.filter(service=>serviceIds.includes(service.id)),petsList.find(p=>p.id===petId)?.size||'medio',sizeRules)}
              value={{professionalId:staffId,date:dateValue,time:timeValue}}
              onChange={selection=>{setStaffId(selection.professionalId);setDateValue(selection.date);setTimeValue(selection.time);setNewError('')}}
              onValidityChange={setScheduleValid}
              tone="dark"
            />
            <label className="grid gap-2 text-sm text-white">Repetição<select value={repeatEvery} onChange={e=>setRepeatEvery(Number(e.target.value))} className="min-h-12 rounded-xl bg-charcoal p-3"><option value={0}>Não repetir</option><option value={7}>Toda semana</option><option value={14}>A cada 15 dias (quinzenal)</option></select></label>
            {repeatEvery>0 && <label className="grid gap-2 text-sm text-white">Quantidade de atendimentos (incluindo o primeiro)<select value={repeatCount} onChange={e=>setRepeatCount(Number(e.target.value))} className="min-h-12 rounded-xl bg-charcoal p-3">{Array.from({length:11},(_,i)=>i+2).map(n=><option key={n} value={n}>{n} atendimentos</option>)}</select></label>}
            {repeatEvery>0 && <p className="text-xs text-charcoal-muted">Os horários serão reservados nas próximas {repeatCount} datas. Se houver conflito, a criação para e informa quantos foram salvos.</p>}
            <div className="rounded-xl border border-white/10 p-4 text-sm text-white">Confira: {customerLabel(clients.find(x=>x.id===clientId))} · {petsList.find(x=>x.id===petId)?.name} · {shopServices.filter(x=>serviceIds.includes(x.id)).map(x=>x.name).join(' + ')}<p className="mt-2 font-semibold text-brass">Total: {formatPrice(shopServices.filter(x=>serviceIds.includes(x.id)).reduce((sum,x)=>sum+servicePrice(x,petsList.find(p=>p.id===petId)?.size||'medio',dateValue),0)+taxiFee)}</p>{newNotes.trim()&&<p className="mt-2 text-charcoal-muted">Observação: {newNotes}</p>}{newTransport&&<p className="mt-2 text-charcoal-muted">Táxi Pet: {transportPending?'valor a confirmar':formatPrice(taxiFee)} · {newAddress}</p>}</div>
          </div>}
          {newError && <p role="alert" className="text-sm text-red-300">{newError}</p>}
          <div className="flex gap-3">{newStep>1 && <button type="button" onClick={()=>setNewStep(newStep-1)} className="rounded-xl border border-white/20 px-5 py-3 text-white">Voltar</button>}<button type="submit" disabled={savingNew || (newStep===3 && !scheduleValid)} className="flex-1 rounded-xl bg-brass px-5 py-3 font-semibold text-charcoal-dark disabled:opacity-50">{savingNew?'Salvando...':newStep===3?'Confirmar agendamento':'Continuar'}</button></div>
        </form>}
      </section>}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2>{barberId ? 'Minha agenda' : 'Agenda'}</h2><button type="button" onClick={()=>setShowAvailability(v=>!v)} className="rounded-lg border border-charcoal-light px-3 text-sm text-charcoal-muted">Folgas e feriados</button></header>
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

      <div className="mb-4 grid grid-cols-3 gap-2 sm:flex sm:overflow-x-auto sm:pb-1">
        {([['today', 'Hoje'], ['tomorrow', 'Amanhã'], ['upcoming', 'Próximos']] as const).map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { if (key !== 'upcoming') setConsultationDate(key === 'today' ? today : tomorrow); setDayFilter(key) }}
              aria-pressed={dayFilter === key}
              className={`min-h-11 rounded-xl px-2 py-2.5 text-center text-sm sm:shrink-0 sm:px-4 ${
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

      <section aria-label="Consulta por dia" className="mb-4 min-w-0 rounded-xl border border-charcoal-light bg-charcoal-dark/30 p-3">
        <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)_44px] items-end gap-2">
          <button type="button" aria-label="Dia anterior" onClick={() => moveDay(-1)} className="min-h-11 rounded-lg border border-charcoal-light text-xl text-white">‹</button>
          <label className="block min-w-0 text-xs text-charcoal-muted">Consultar dia
            <input type="date" value={selectedDay} onChange={event => chooseDay(event.target.value)} className="mt-1 block min-h-11 w-full min-w-0 max-w-full rounded-lg border border-charcoal-light bg-charcoal px-2 text-sm text-white [color-scheme:dark]" />
          </label>
          <button type="button" aria-label="Dia seguinte" onClick={() => moveDay(1)} className="min-h-11 rounded-lg border border-charcoal-light text-xl text-white">›</button>
        </div>
        <p aria-live="polite" className="mt-2 text-center text-sm text-white">
          {dayFilter === 'upcoming' ? 'Próximos atendimentos' : new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selectedDay}T12:00:00`))}
          {!loading && !loadError && <span className="ml-1 text-charcoal-muted">· {filtered.length} {filtered.length === 1 ? 'atendimento' : 'atendimentos'}</span>}
        </p>
      </section>

      <details className="group mb-5 rounded-xl border border-charcoal-light bg-charcoal-dark/30 p-3 sm:mb-8 sm:rounded-2xl sm:p-4">
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
              const total = bookingTotal(b)
              const petList = petsForBooking(b)
              const petLabel = petList.map((p) => p.name).join(' · ')
              return (
                <div key={b.id} className="rounded-lg bg-charcoal-light/30 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white">
                      {petLabel ? `${petLabel} · ${customerLabel({name:b.shop_customers?.name ?? b.client_name,phone:b.client_phone})}` : customerLabel({name:b.shop_customers?.name ?? b.client_name,phone:b.client_phone})}
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

      {!barberId && <div className="mb-4 flex flex-wrap gap-2"><HistoricalBooking rules={sizeRules} discounts={weekdayDiscounts} shopId={shopId} services={shopServices} onSaved={()=>void load()}/><AgendaManagement loading={loading} shopId={shopId} bookings={filtered} services={shopServices} rules={sizeRules} onChanged={()=>void load()}/></div>}
      {loading ? <LoadingBlock label="Carregando agenda..." /> : loadError ? <button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-charcoal-light px-4 text-sm text-white">Tentar novamente</button> : filtered.length === 0 ? (
        <EmptyState
          title={dayFilter === 'upcoming' ? 'Nenhum agendamento neste período.' : 'Nenhum agendamento neste dia.'}
          description="Quando houver reservas, elas aparecem aqui com pet, horário e serviço."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const services = Array.from(
              new Map(
                (b.booking_services || []).map((bs) => [bs.service_id, bs.services])
              ).values()
            )
            const total = bookingTotal(b)
            const status = b.status || 'scheduled'
            const duration =
              b.duration_minutes ||
              services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
            const petList = petsForBooking(b)
            const mainPet = petList[0]
            return (
              <article id={`booking-${b.id}`} tabIndex={-1} data-testid={`booking-${b.id}`} key={b.id} className="rounded-xl border border-charcoal-light bg-charcoal p-4">
                <div className="mb-3 flex items-center justify-between border-b border-charcoal-light pb-3">
                  <p className="font-mono text-base text-brass">{formatTime(b.time)}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-charcoal-muted">{formatDate(b.date)}</p>
                </div>

                <div className="flex flex-wrap justify-between gap-3">
                  <div className="flex gap-3">
                    {mainPet?.photo_url ? (
                      <img
                        src={mainPet.photo_url}
                        alt=""
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                    ) : mainPet ? (
                      <DefaultAvatar
                        name={mainPet.name}
                        className="h-10 w-10 rounded-xl text-lg"
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
                        <p className="text-sm text-white mt-1">Cliente: {customerLabel({name:b.shop_customers?.name ?? b.client_name,phone:b.client_phone})}</p>
                        <p className="text-sm text-charcoal-muted">{b.client_phone}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-white">{customerLabel({name:b.shop_customers?.name ?? b.client_name,phone:b.client_phone})}</p>
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
          <BookingConfirmationReminder booking={b} shopName={shopName} due={pendingReminderIds.includes(b.id)} onUpdate={async()=>{await load();onReminderUpdate?.()}}/>
          <button type="button" onClick={() => { setReservedMinutes(String(b.duration_minutes || 30)); setEditStaffId(b.barber_id); setEditingBooking(b); setExtraServiceIds([]); setExtraError('');setEditScheduleValid(false);setEditDate(b.date);setEditTime(b.time.slice(0,5));setEditNotes(b.notes||'') }}
            className="min-h-11 w-full rounded-xl border border-brass/40 px-4 py-2.5 text-center text-sm font-medium text-brass hover:bg-brass/10 sm:w-auto">
            Editar / adicionar serviços
          </button>
                <BookingActions
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
        <Modal label="Editar atendimento" onClose={()=>setEditingBooking(null)} busy={savingExtras} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90dvh] overflow-y-auto w-full max-w-md rounded-2xl border border-brass/25 bg-charcoal-dark p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-lg font-semibold text-white">Editar atendimento</h3>
                <p className="mt-1 text-sm text-charcoal-muted">{customerLabel({name:editingBooking.shop_customers?.name ?? editingBooking.client_name,phone:editingBooking.client_phone})} · {formatDate(editingBooking.date)}</p></div>
              <button type="button" onClick={() => setEditingBooking(null)} className="rounded-lg px-3 py-2 text-sm text-charcoal-muted">Fechar</button>
            </div>
            <div className="mt-4">{['in_progress','awaiting_payment'].includes(editingBooking.status || '') ? <p className="text-sm text-charcoal-muted">Atendimento iniciado em {formatDate(editingBooking.date)} às {formatTime(editingBooking.time)}. Você pode acrescentar serviços abaixo.</p> : <BookingSchedulePicker
              shopId={shopId}
              professionals={barberId ? teamList.filter(person=>person.id===barberId) : teamList}
              serviceIds={[...(editingBooking.booking_services || []).map(item=>item.service_id),...extraServiceIds]}
              duration={Number(reservedMinutes) || 1}
              value={{professionalId:editStaffId,date:editDate,time:editTime}}
              excludeBooking={{professionalId:editingBooking.barber_id,date:editingBooking.date,time:editingBooking.time}}
              onChange={selection=>{setEditStaffId(selection.professionalId);setEditDate(selection.date);setEditTime(selection.time)}}
              onValidityChange={setEditScheduleValid}
              tone="dark"
            />}</div>
            <label className="mt-4 block text-sm text-white">Tempo reservado na agenda (min)<input type="number" min="1" max="720" step="1" className="mt-1 min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal p-2" value={reservedMinutes} onChange={e=>setReservedMinutes(e.target.value)}/></label><p className="mt-1 text-xs text-charcoal-muted">Mantenha o tempo se os extras couberem no horário. Aumentos dependem da disponibilidade.</p><label className="mt-3 block text-sm">Observações<textarea className="mt-1 w-full bg-charcoal p-2" value={editNotes} onChange={e=>setEditNotes(e.target.value)}/></label><p className="mt-3 text-sm text-charcoal-muted">Serviços adicionais</p><div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
              {shopServices.filter(service => service.is_active!==false && !(editingBooking.booking_services || []).some(item => item.service_id === service.id)).map(service => (
                <label key={service.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 text-sm text-white">
                  <input type="checkbox" value={service.id} className="h-4 w-4 accent-amber-500" checked={extraServiceIds.includes(service.id)}
                    onChange={event => setExtraServiceIds(current => event.target.checked ? [...current, service.id] : current.filter(id => id !== service.id))} />
                  <span className="flex-1">{service.name}</span><span className="text-brass">{formatPrice(servicePrice(service,editingBooking.pets?.size||'medio',editDate))}</span>
                </label>
              ))}
            </div>
            {extraError && <p role="alert" className="mt-3 text-sm text-red-400">{extraError}</p>}
            <button type="button" disabled={savingExtras || (!['in_progress','awaiting_payment'].includes(editingBooking.status || '') && !editScheduleValid)} onClick={() => void saveExtraServices()}
              className="mt-5 min-h-12 w-full rounded-xl bg-brass px-4 py-3 text-center font-semibold text-charcoal disabled:opacity-50">
              {savingExtras ? 'Salvando...' : 'Salvar atendimento'}
            </button>
          </div>
        </Modal>
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
