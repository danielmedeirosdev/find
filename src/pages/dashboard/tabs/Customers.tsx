import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPhone, formatDate, formatTime, formatPrice } from '../../../lib/format'
import { petSizeLabel } from '../../../lib/pet'
import { packageRemaining } from '../../../lib/notifications'
import { FieldHint, FieldLabel } from '../../../components/FormHints'
import { DefaultAvatar, Toast } from '../../../components/MediaUI'
import type {
  BookingWithDetails,
  CustomerPackage,
  Pet,
  ShopCustomer,
} from '../../../lib/types'

interface Props {
  shopId: string
}

export function CustomersTab({ shopId }: Props) {
  const [customers, setCustomers] = useState<ShopCustomer[]>([])
  const [petsByCustomer, setPetsByCustomer] = useState<Record<string, Pet[]>>({})
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [packages, setPackages] = useState<CustomerPackage[]>([])
  const [history, setHistory] = useState<BookingWithDetails[]>([])

  const load = useCallback(async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('shop_customers').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('pets').select('*').eq('shop_id', shopId).order('name'),
    ])
    const list = (c as ShopCustomer[]) || []
    setCustomers(list)
    const map: Record<string, Pet[]> = {}
    for (const pet of (p as Pet[]) || []) {
      if (!map[pet.customer_id]) map[pet.customer_id] = []
      map[pet.customer_id].push(pet)
    }
    setPetsByCustomer(map)
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setPackages([])
      setHistory([])
      setEditNotes('')
      return
    }
    const selected = customers.find((c) => c.id === selectedId)
    setEditNotes(selected?.notes || '')

    Promise.all([
      supabase
        .from('customer_packages')
        .select('*, service_packages(*), pets(id,name,size,photo_url)')
        .eq('customer_id', selectedId)
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select(`
          *,
          pets(id, name, size),
          barbers(name),
          booking_services(service_id, services(name, price))
        `)
        .eq('shop_customer_id', selectedId)
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(30),
    ]).then(([{ data: pkgs }, { data: bookings }]) => {
      setPackages((pkgs as CustomerPackage[]) || [])
      setHistory((bookings as BookingWithDetails[]) || [])
    })
  }, [selectedId, customers])

  const addCustomer = async () => {
    const digits = phone.replace(/\D/g, '')
    if (!name.trim() || digits.length < 10) {
      setToast('Informe nome e WhatsApp válidos.')
      return
    }
    const { error } = await supabase.from('shop_customers').insert({
      shop_id: shopId,
      name: name.trim(),
      phone: digits,
      notes: notes.trim() || null,
    })
    if (error) {
      setToast(/unique|duplicate/i.test(error.message) ? 'Já existe cliente com este telefone.' : error.message)
      return
    }
    setName('')
    setPhone('')
    setNotes('')
    setToast('Cliente cadastrado.')
    load()
  }

  const saveNotes = async () => {
    if (!selectedId) return
    const { error } = await supabase
      .from('shop_customers')
      .update({ notes: editNotes.trim() || null })
      .eq('id', selectedId)
    if (error) {
      setToast(error.message)
      return
    }
    setToast('Observações salvas.')
    load()
  }

  const removeCustomer = async (id: string) => {
    if (!confirm('Remover cliente e todos os pets vinculados?')) return
    await supabase.from('shop_customers').delete().eq('id', id)
    if (selectedId === id) setSelectedId(null)
    load()
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  const selected = customers.find((c) => c.id === selectedId)

  return (
    <div>
      <Toast message={toast} onClose={() => setToast(null)} />
      <h2 className="font-display text-2xl text-white mb-2">Clientes</h2>
      <p className="text-sm text-charcoal-muted mb-6">
        Cada cliente pode ter vários pets, pacotes e histórico de atendimentos.
      </p>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div>
          <FieldLabel>Nome</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Maria Silva"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
        </div>
        <div>
          <FieldLabel>WhatsApp</FieldLabel>
          <input
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="Ex: (11) 99999-9999"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={addCustomer}
            className="w-full rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal"
          >
            Adicionar
          </button>
        </div>
      </div>
      <FieldHint>Observações opcionais podem ser editadas no perfil do cliente.</FieldHint>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          {customers.length === 0 ? (
            <p className="text-charcoal-muted">Nenhum cliente ainda.</p>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-lg border p-4 text-left ${
                  selectedId === c.id ? 'border-brass bg-brass/10' : 'border-charcoal-light'
                }`}
              >
                <p className="font-medium text-white">{c.name}</p>
                <p className="text-sm text-charcoal-muted">{c.phone}</p>
                <p className="text-xs text-brass mt-1">
                  {(petsByCustomer[c.id] || []).length} pet
                  {(petsByCustomer[c.id] || []).length === 1 ? '' : 's'}
                </p>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="rounded-lg border border-charcoal-light p-5 space-y-5">
            <div>
              <h3 className="font-display text-xl text-brass">{selected.name}</h3>
              <p className="text-sm text-charcoal-muted">{selected.phone}</p>
            </div>

            <div>
              <p className="text-sm text-charcoal-muted mb-2">Pets</p>
              <div className="space-y-2">
                {(petsByCustomer[selected.id] || []).length === 0 ? (
                  <p className="text-sm text-charcoal-muted">Nenhum pet vinculado.</p>
                ) : (
                  (petsByCustomer[selected.id] || []).map((pet) => (
                    <div key={pet.id} className="flex items-center gap-3 rounded bg-charcoal-light/30 p-2">
                      {pet.photo_url ? (
                        <img src={pet.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <DefaultAvatar name={pet.name} className="h-10 w-10 rounded-lg" />
                      )}
                      <div>
                        <p className="text-white text-sm">{pet.name}</p>
                        <p className="text-xs text-charcoal-muted">{petSizeLabel(pet.size)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-charcoal-muted mb-2">Pacotes</p>
              {packages.length === 0 ? (
                <p className="text-sm text-charcoal-muted">Nenhum pacote.</p>
              ) : (
                <div className="space-y-2">
                  {packages.map((pkg) => (
                    <div key={pkg.id} className="rounded bg-charcoal-light/30 p-2 text-sm">
                      <p className="text-white">
                        {pkg.service_packages?.name || 'Pacote'} · {pkg.pets?.name}
                      </p>
                      <p className="text-charcoal-muted">
                        Restantes {packageRemaining(pkg.total_sessions, pkg.used_sessions)} de{' '}
                        {pkg.total_sessions} · {pkg.status}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-charcoal-muted mb-2">Histórico</p>
              {history.length === 0 ? (
                <p className="text-sm text-charcoal-muted">Sem atendimentos.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {history.map((b) => {
                    const services = (b.booking_services || []).map((bs) => bs.services)
                    const total = services.reduce((s, x) => s + Number(x.price), 0)
                    return (
                      <div key={b.id} className="rounded bg-charcoal-light/30 p-2 text-sm">
                        <p className="text-white">
                          {formatDate(b.date)} · {formatTime(b.time)}
                          {b.pets?.name ? ` · ${b.pets.name}` : ''}
                        </p>
                        <p className="text-charcoal-muted">
                          {services.map((s) => s.name).join(' · ') || 'Serviço'}
                          {total > 0 ? ` · ${formatPrice(total)}` : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <FieldLabel>Observações</FieldLabel>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white"
              />
              <button
                onClick={saveNotes}
                className="mt-2 rounded-lg border border-charcoal-light px-3 py-1.5 text-sm text-charcoal-muted hover:text-white"
              >
                Salvar observações
              </button>
            </div>

            <button onClick={() => removeCustomer(selected.id)} className="text-sm text-red-400">
              Remover cliente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
