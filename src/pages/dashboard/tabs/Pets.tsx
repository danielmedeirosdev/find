import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { deleteShopMedia, uploadShopMedia } from '../../../lib/media'
import { petSizeLabel } from '../../../lib/pet'
import { formatPhone } from '../../../lib/format'
import { DefaultAvatar, ImageDropzone, ProgressBar, Toast } from '../../../components/MediaUI'
import { FieldLabel } from '../../../components/FormHints'
import { PET_SIZES, type BookingWithDetails, type Pet, type PetSize, type ShopCustomer } from '../../../lib/types'
import { userFacingError } from '../../../lib/userFacingError'
import { formatDate, formatTime } from '../../../lib/format'

interface Props {
  shopId: string
}

export function PetsTab({ shopId }: Props) {
  const [pets, setPets] = useState<Pet[]>([])
  const [customers, setCustomers] = useState<ShopCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Pet | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const [name, setName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [size, setSize] = useState<PetSize>('medio')
  const [breed, setBreed] = useState('')
  const [species, setSpecies] = useState('cao')
  const [sex, setSex] = useState<'macho' | 'femea' | ''>('')
  const [notes, setNotes] = useState('')
  const [behavior, setBehavior] = useState('')
  const [allergies, setAllergies] = useState('')
  const [preferences, setPreferences] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [specialNeeds, setSpecialNeeds] = useState('')
  const [history, setHistory] = useState<BookingWithDetails[]>([])

  const load = useCallback(async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase
        .from('pets')
        .select('*, shop_customers(*)')
        .eq('shop_id', shopId)
        .order('name'),
      supabase.from('shop_customers').select('*').eq('shop_id', shopId).order('name'),
    ])
    setPets((p as Pet[]) || [])
    setCustomers((c as ShopCustomer[]) || [])
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selected) {
      setHistory([])
      return
    }
    supabase
      .from('bookings')
      .select(`
        *,
        barbers(name),
        booking_services(service_id, services(name, price, duration_minutes))
      `)
      .eq('pet_id', selected.id)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory((data as BookingWithDetails[]) || []))
  }, [selected])

  const resetForm = () => {
    setName('')
    setCustomerId('')
    setNewCustomerName('')
    setNewCustomerPhone('')
    setSize('medio')
    setBreed('')
    setSpecies('cao')
    setSex('')
    setNotes('')
    setBehavior('')
    setAllergies('')
    setPreferences('')
    setWeightKg('')
    setBirthDate('')
    setSpecialNeeds('')
    setShowForm(false)
  }

  const savePet = async () => {
    if (!name.trim()) return
    let custId = customerId
    if (!custId) {
      const phone = newCustomerPhone.replace(/\D/g, '')
      if (!newCustomerName.trim() || phone.length < 10) {
        setToast('Informe o responsável (nome e WhatsApp) ou escolha um já cadastrado.')
        return
      }
      const { data: existing } = await supabase
        .from('shop_customers')
        .select('id')
        .eq('shop_id', shopId)
        .eq('phone', phone)
        .maybeSingle()
      if (existing) {
        custId = existing.id
      } else {
        const { data: created, error } = await supabase
          .from('shop_customers')
          .insert({
            shop_id: shopId,
            name: newCustomerName.trim(),
            phone,
          })
          .select('id')
          .single()
        if (error || !created) {
          setToast(userFacingError(error, 'Não foi possível cadastrar o cliente. Tente novamente.'))
          return
        }
        custId = created.id
      }
    }

    const { error } = await supabase.from('pets').insert({
      shop_id: shopId,
      customer_id: custId,
      name: name.trim(),
      size,
      breed: breed.trim() || null,
      species: species.trim() || 'cao',
      sex: sex || null,
      notes: notes.trim() || null,
      behavior: behavior.trim() || null,
      allergies: allergies.trim() || null,
      preferences: preferences.trim() || null,
      weight_kg: weightKg ? Number(weightKg) : null,
      birth_date: birthDate || null,
      special_needs: specialNeeds.trim() || null,
    })
    if (error) {
      setToast(userFacingError(error, 'Não foi possível cadastrar o pet. Tente novamente.'))
      return
    }
    setToast('Pet cadastrado com sucesso.')
    resetForm()
    load()
  }

  const uploadPhoto = async (pet: Pet, files: File[]) => {
    const file = files[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadShopMedia(shopId, file, 'gallery', setProgress)
      if (pet.photo_url) await deleteShopMedia(pet.photo_url)
      await supabase.from('pets').update({ photo_url: url }).eq('id', pet.id)
      setToast('Foto atualizada.')
      load()
      if (selected?.id === pet.id) setSelected({ ...pet, photo_url: url })
    } catch (err) {
      setToast(userFacingError(err, 'Não foi possível enviar a foto. Tente novamente.'))
    }
    setUploading(false)
  }

  const removePet = async (pet: Pet) => {
    if (!confirm(`Remover ${pet.name} do cadastro? Esta ação não pode ser desfeita.`)) return
    if (pet.photo_url) await deleteShopMedia(pet.photo_url)
    await supabase.from('pets').delete().eq('id', pet.id)
    if (selected?.id === pet.id) setSelected(null)
    load()
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  return (
    <div>
      <Toast message={toast} onClose={() => setToast(null)} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-white">Pets</h2>
          <p className="text-sm text-charcoal-muted mt-1">
            Cadastre os animais com porte, foto e observações. O porte define a duração na agenda.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal"
        >
          + Novo pet
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-lg border border-charcoal-light p-5 space-y-3">
          <h3 className="font-medium text-white">Cadastrar pet</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Nome do pet</FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Thor"
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
              />
            </div>
            <div>
              <FieldLabel>Porte</FieldLabel>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as PetSize)}
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
              >
                {PET_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Raça</FieldLabel>
              <input
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="Ex: Golden Retriever"
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
              />
            </div>
            <div>
              <FieldLabel>Sexo</FieldLabel>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as '' | 'macho' | 'femea')}
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
              >
                <option value="">—</option>
                <option value="macho">Macho</option>
                <option value="femea">Fêmea</option>
              </select>
            </div>
          </div>

          <div>
            <FieldLabel>Responsável existente</FieldLabel>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
            >
              <option value="">Novo responsável…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </select>
          </div>
          {!customerId && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Nome do responsável</FieldLabel>
                <input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
                />
              </div>
              <div>
                <FieldLabel>WhatsApp</FieldLabel>
                <input
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(formatPhone(e.target.value))}
                  placeholder="Ex: (11) 99999-9999"
                  className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <FieldLabel>Comportamento / observações</FieldLabel>
            <textarea
              value={behavior || notes}
              onChange={(e) => {
                setBehavior(e.target.value)
                setNotes(e.target.value)
              }}
              rows={2}
              placeholder='Ex: "Fica agitado com secador."'
              className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Alergias</FieldLabel>
              <input
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
              />
            </div>
            <div>
              <FieldLabel>Preferências de banho/tosa</FieldLabel>
              <input
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel>Peso (kg)</FieldLabel>
              <input
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                type="number"
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
              />
            </div>
            <div>
              <FieldLabel>Nascimento</FieldLabel>
              <input
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                type="date"
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
              />
            </div>
            <div>
              <FieldLabel>Necessidades especiais</FieldLabel>
              <input
                value={specialNeeds}
                onChange={(e) => setSpecialNeeds(e.target.value)}
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={savePet}
              className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal"
            >
              Salvar pet
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-charcoal-light px-4 py-2 text-charcoal-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {pets.length === 0 ? (
            <p className="text-charcoal-muted">Nenhum pet cadastrado ainda.</p>
          ) : (
            pets.map((pet) => (
              <button
                key={pet.id}
                type="button"
                onClick={() => setSelected(pet)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  selected?.id === pet.id
                    ? 'border-brass bg-brass/10'
                    : 'border-charcoal-light hover:border-brass/50'
                }`}
              >
                {pet.photo_url ? (
                  <img
                    src={pet.photo_url}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                ) : (
                  <DefaultAvatar name={pet.name} className="h-14 w-14 text-xl rounded-xl" />
                )}
                <div>
                  <p className="font-medium text-white">{pet.name}</p>
                  <p className="text-xs text-charcoal-muted">
                    {pet.breed || 'Sem raça'} · {petSizeLabel(pet.size)}
                  </p>
                  <p className="text-xs text-charcoal-muted">
                    {pet.shop_customers?.name} · {pet.shop_customers?.phone}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="rounded-lg border border-charcoal-light p-5">
            <div className="flex flex-col items-center text-center mb-4">
              {selected.photo_url ? (
                <img
                  src={selected.photo_url}
                  alt={selected.name}
                  className="h-32 w-32 rounded-2xl object-cover border border-charcoal-light"
                />
              ) : (
                <DefaultAvatar name={selected.name} className="h-32 w-32 text-4xl rounded-2xl" />
              )}
              <h3 className="font-display text-2xl text-brass mt-3">{selected.name}</h3>
              <p className="text-sm text-charcoal-muted">
                {selected.breed || selected.species} · Porte {petSizeLabel(selected.size)}
              </p>
              <ImageDropzone
                onFiles={(f) => uploadPhoto(selected, f)}
                disabled={uploading}
                className="mt-3 rounded border border-dashed border-charcoal-light px-3 py-1 text-xs text-brass"
              >
                {selected.photo_url ? 'Trocar foto' : 'Adicionar foto'}
              </ImageDropzone>
              {uploading && (
                <div className="mt-2 w-40">
                  <ProgressBar value={progress} />
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm text-left">
              <p className="text-charcoal-muted">Responsável</p>
              <p className="text-white">
                {selected.shop_customers?.name}
                <br />
                <span className="text-charcoal-muted">{selected.shop_customers?.phone}</span>
              </p>
              {(selected.behavior || selected.notes) && (
                <>
                  <p className="text-charcoal-muted pt-2">Observações</p>
                  <p className="text-white">{selected.behavior || selected.notes}</p>
                </>
              )}
              {selected.allergies && (
                <>
                  <p className="text-charcoal-muted pt-2">Alergias</p>
                  <p className="text-white">{selected.allergies}</p>
                </>
              )}
              {(selected.weight_kg || selected.birth_date || selected.special_needs) && (
                <>
                  <p className="text-charcoal-muted pt-2">Dados</p>
                  <p className="text-white text-sm">
                    {selected.weight_kg ? `${selected.weight_kg} kg` : null}
                    {selected.weight_kg && selected.birth_date ? ' · ' : ''}
                    {selected.birth_date ? `Nasc. ${formatDate(selected.birth_date)}` : null}
                    {selected.special_needs && (
                      <span className="block mt-1">{selected.special_needs}</span>
                    )}
                  </p>
                </>
              )}
              <p className="text-charcoal-muted pt-3">Histórico</p>
              {history.length === 0 ? (
                <p className="text-sm text-charcoal-muted">Sem atendimentos registrados.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((b) => {
                    const services = (b.booking_services || []).map((bs) => bs.services.name)
                    const isNext =
                      (b.status === 'scheduled' || b.status === 'confirmed') &&
                      b.date >= new Date().toISOString().slice(0, 10)
                    return (
                      <div key={b.id} className="rounded-lg bg-charcoal-light/30 p-2 text-sm">
                        <p className="text-white">
                          {formatDate(b.date)} · {formatTime(b.time)}
                          {isNext ? ' · próximo' : ''}
                        </p>
                        <p className="text-charcoal-muted">
                          {services.join(' · ') || 'Serviço'} · {b.status || 'scheduled'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <button
              onClick={() => removePet(selected)}
              className="mt-6 text-sm text-red-400 hover:text-red-300"
            >
              Remover pet
            </button>
            <p className="mt-4 text-xs text-charcoal-muted">
              <Link to="?aba=customers" className="text-brass hover:underline">
                Ver clientes
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
