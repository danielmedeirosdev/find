import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { customerLabel, formatPhone } from '../lib/format'
import { userFacingError } from '../lib/userFacingError'
import { upsertPetCustomer } from '../lib/secureBooking'
import { PET_SIZES, type PetSize } from '../lib/types'

export type BookingCustomer = { id: string; name: string; phone: string }
export type BookingPet = { id: string; name: string; customer_id: string; size: PetSize }
interface Props {
  shopId: string
  clients: BookingCustomer[]
  pets: BookingPet[]
  clientId: string
  petId: string
  onSelection: (clientId: string, petId: string) => void
  onCustomer: (client: BookingCustomer) => void
  onPet: (pet: BookingPet) => void
}
export function BookingCustomerPicker({ shopId, clients, pets, clientId, petId, onSelection, onCustomer, onPet }: Props) {
  const [quick, setQuick] = useState(false)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newPet, setNewPet] = useState(false)
  const [petName, setPetName] = useState('')
  const [petSize, setPetSize] = useState<PetSize>('medio')
  const [clientName, setClientName] = useState('')
  const selectedClient = clients.find(client => client.id === clientId)
  const clientOption = (client: BookingCustomer) => {
    const petNames = pets.filter(pet => pet.customer_id === client.id).map(pet => pet.name).join(' · ')
    return client.name.trim() ? customerLabel(client) : petNames ? `Responsável por ${petNames}` : 'Nome não informado'
  }
  const register = async () => {
    if (saving) return
    setSaving(true); setError(''); setNotice('')
    const { data, error: registerError } = await supabase.rpc('quick_register_customer', { p_shop_id: shopId, p_phone: phone })
    setSaving(false)
    if (registerError) { setError(userFacingError(registerError, 'Não foi possível cadastrar o cliente.')); return }
    const client = data as BookingCustomer
    onCustomer(client); onSelection(client.id, ''); setQuick(false); setPhone(''); setNewPet(false); setClientName('')
    setNotice(client.name.trim() ? `Cliente encontrado: ${client.name}.` : 'Cadastro vinculado ao WhatsApp. O nome pode ser informado abaixo ou depois na área Clientes.')
  }
  const saveClientName = async () => {
    if (saving || !selectedClient) return
    if (clientName.trim().length < 2) { setError('Informe o nome do cliente com pelo menos 2 caracteres.'); return }
    setSaving(true); setError('')
    try {
      const client = await upsertPetCustomer(shopId, selectedClient.phone, clientName.trim())
      if (client.id !== selectedClient.id) throw new Error('O cadastro foi alterado. Busque o cliente novamente pelo WhatsApp.')
      onCustomer(client)
      setClientName(''); setNotice('Nome salvo. Os pets e o histórico continuam no mesmo cadastro.')
    } catch (err) { setError(userFacingError(err, 'Não foi possível salvar o nome do cliente.')) }
    finally { setSaving(false) }
  }
  const registerPet = async () => {
    if (saving || !clientId) return
    if (!petName.trim()) { setError('Informe o nome do pet.'); return }
    setSaving(true); setError('')
    const { data, error: petError } = await supabase.from('pets').insert({ shop_id: shopId, customer_id: clientId, name: petName.trim(), size: petSize }).select('id,name,customer_id,size').single()
    setSaving(false)
    if (petError) { setError(userFacingError(petError, 'Não foi possível cadastrar o pet.')); return }
    onPet(data); onSelection(clientId, data.id); setNewPet(false); setPetName('')
    setNotice('Pet cadastrado e selecionado.')
  }
  return <div className="space-y-4">
    <label className="grid gap-2 text-sm text-white">Cliente<select required value={clientId} disabled={saving} onChange={e => { onSelection(e.target.value, ''); setNewPet(false); setError(''); setNotice(''); setClientName('') }} className="min-h-12 rounded-xl bg-charcoal p-3"><option value="">Selecione um cliente</option>{clients.map(client => <option key={client.id} value={client.id}>{clientOption(client)}</option>)}</select></label>
    {selectedClient && <div className="space-y-3 rounded-xl border border-white/10 p-3">
      <div data-testid="customer-contact"><p className="text-xs text-charcoal-muted">WhatsApp do cadastro</p><p className="mt-1 text-sm text-white">{formatPhone(selectedClient.phone)}</p></div>
      {!selectedClient.name.trim() && <div className="space-y-2">
        <label className="grid gap-2 text-sm text-white">Nome do cliente (opcional)<input value={clientName} onChange={e => setClientName(e.target.value)} maxLength={120} placeholder="Como o cliente se chama?" className="min-h-12 w-full rounded-xl bg-charcoal p-3" onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();void saveClientName()} }}/></label>

        <button type="button" disabled={saving || !clientName.trim()} onClick={() => void saveClientName()} className="min-h-11 rounded-xl border border-brass/40 px-4 py-2 text-sm font-semibold text-brass disabled:opacity-50">{saving?'Salvando...':'Salvar nome do cliente'}</button>
      </div>}
    </div>}
    <button type="button" className="min-h-11 text-sm font-medium text-brass" onClick={() => { setQuick(!quick); setError('') }}>{quick ? 'Fechar cadastro rápido' : '+ Buscar ou cadastrar por WhatsApp'}</button>
    {quick && <div className="space-y-3 rounded-xl border border-brass/30 p-3">
      <label className="grid gap-2 text-sm text-white">WhatsApp do cliente<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="(19) 99999-9999" className="min-h-12 w-full rounded-xl bg-charcoal p-3" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void register() } }}/></label>
      <p className="text-xs text-charcoal-muted">Cadastros existentes serão reaproveitados.</p>
      <button type="button" disabled={saving} onClick={() => void register()} className="min-h-11 w-full rounded-xl bg-brass p-3 text-sm font-semibold text-charcoal disabled:opacity-50">{saving ? 'Conferindo...' : 'Usar este WhatsApp'}</button>
    </div>}
    {notice && <p role="status" className="text-sm text-brass">{notice}</p>}
    <label className="grid gap-2 text-sm text-white">Pet<select required value={petId} disabled={!clientId || saving} onChange={e => onSelection(clientId, e.target.value)} className="min-h-12 rounded-xl bg-charcoal p-3"><option value="">Selecione o pet</option>{pets.filter(pet => pet.customer_id === clientId).map(pet => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
    {clientId && <button type="button" onClick={() => { setNewPet(!newPet); setError('') }} className="min-h-11 text-sm font-medium text-brass">{newPet ? 'Fechar cadastro do pet' : '+ Cadastrar pet aqui'}</button>}
    {newPet && <div className="space-y-3 rounded-xl border border-white/10 p-3">
      <label className="grid gap-2 text-sm text-white">Nome do pet<input value={petName} onChange={e => setPetName(e.target.value)} maxLength={120} className="min-h-12 w-full rounded-xl bg-charcoal p-3"/></label>
      <label className="grid gap-2 text-sm text-white">Porte do pet<select value={petSize} onChange={e => setPetSize(e.target.value as PetSize)} className="min-h-12 rounded-xl bg-charcoal p-3">{PET_SIZES.map(size => <option key={size.value} value={size.value}>{size.label}</option>)}</select></label>
      <button type="button" disabled={saving} onClick={() => void registerPet()} className="min-h-11 w-full rounded-xl bg-brass p-3 text-sm font-semibold text-charcoal disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar pet e selecionar'}</button>
    </div>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </div>
}
