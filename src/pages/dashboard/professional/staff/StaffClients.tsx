import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { formatDate, formatTime, formatPhone, whatsappUrl } from '../../../../lib/format'
import { EmptyState, InlineError, LoadingBlock } from '../../../../components/EmptyState'
import { userFacingError } from '../../../../lib/userFacingError'
import type { BookingWithDetails } from '../../../../lib/types'

interface Props {
  shopId: string
  barberId: string
}

export function StaffClientsTab({ shopId, barberId }: Props) {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [petName, setPetName] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { data, error: qError } = await supabase
      .from('bookings')
      .select('id, client_name, client_phone, date, time, status')
      .eq('shop_id', shopId)
      .eq('barber_id', barberId)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(200)

    if (qError) {
      setError(userFacingError(qError, 'Não foi possível carregar seus clientes.'))
      setBookings([])
    } else {
      setBookings((data as BookingWithDetails[]) || [])
    }
    setLoading(false)
  }, [shopId, barberId])

  useEffect(() => {
    load()
  }, [load])

  const clients = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string; lastDate: string; lastTime: string; count: number }
    >()
    for (const b of bookings) {
      const key = `${(b.client_phone || '').replace(/\D/g, '')}|${(b.client_name || '').toLowerCase()}`
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          name: b.client_name,
          phone: b.client_phone,
          lastDate: b.date,
          lastTime: b.time,
          count: 1,
        })
      } else {
        existing.count += 1
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [bookings])

  const saveCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!customerName.trim() || !customerPhone.trim()) return
    setSaving(true)
    setError('')
    setNotice('')
    const {data: customer,error: customerError}=await supabase.from('shop_customers')
      .insert({shop_id:shopId,name:customerName.trim(),phone:customerPhone.trim()}).select('id').single()
    if(customerError){setError(userFacingError(customerError,'Não foi possível cadastrar o cliente.'));setSaving(false);return}
    if(petName.trim()){
      const {error: petError}=await supabase.from('pets').insert({shop_id:shopId,customer_id:customer.id,name:petName.trim()})
      if(petError){setError('Cliente cadastrado, mas não foi possível cadastrar o pet.');setSaving(false);return}
    }
    setCustomerName('');setCustomerPhone('');setPetName('');setAdding(false);setSaving(false)
    setNotice('Cliente cadastrado. Já pode selecioná-lo em Novo agendamento.')
    await load()
  }

  if (loading) return <LoadingBlock label="Carregando clientes..." />

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl text-white">Meus clientes</h2><button type="button" onClick={()=>setAdding(v=>!v)} className="rounded-xl bg-brass px-4 py-2 font-semibold text-charcoal-dark">+ Cadastrar cliente</button></div>
      <p className="mb-4 text-sm text-charcoal-muted">Consulte seus atendimentos ou cadastre um cliente para agendar.</p>
      {notice && <p role="status" className="mb-4 text-sm text-emerald-300">{notice}</p>}
      {adding && <form onSubmit={saveCustomer} className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <label className="grid gap-1 text-sm text-white">Nome do cliente<input required value={customerName} onChange={e=>setCustomerName(e.target.value)} className="rounded-lg border border-white/15 bg-charcoal p-3"/></label>
        <label className="grid gap-1 text-sm text-white">WhatsApp<input required type="tel" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} className="rounded-lg border border-white/15 bg-charcoal p-3"/></label>
        <label className="grid gap-1 text-sm text-white">Nome do pet (opcional)<input value={petName} onChange={e=>setPetName(e.target.value)} className="rounded-lg border border-white/15 bg-charcoal p-3"/></label>
        <button type="submit" disabled={saving} className="rounded-lg bg-brass p-3 font-semibold text-charcoal-dark disabled:opacity-50">{saving?'Salvando...':'Salvar cliente'}</button>
      </form>}
      {error && (
        <div className="mb-4">
          <InlineError message={error} />
        </div>
      )}
      {clients.length === 0 ? (
        <EmptyState
          title="Ainda não há clientes nos seus atendimentos."
          description="Quando houver agendamentos na sua agenda, os clientes aparecerão aqui."
        />
      ) : (
        <ul className="space-y-3">
          {clients.map((c) => {
            const whatsapp = whatsappUrl(c.phone)
            return (
              <li
                key={`${c.phone}-${c.name}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-light px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{c.name}</p>
                  <p className="mt-0.5 text-sm tabular-nums text-charcoal-muted">
                    {formatPhone(c.phone) || 'Sem telefone'}
                  </p>
                  <p className="mt-1 text-xs text-charcoal-muted">
                    Último: {formatDate(c.lastDate)} · {formatTime(c.lastTime)} · {c.count}{' '}
                    {c.count === 1 ? 'atendimento' : 'atendimentos'}
                  </p>
                </div>
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir WhatsApp de ${c.name}`}
                    className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300"
                  >
                    WhatsApp
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
