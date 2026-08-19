import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice, formatDate } from '../../../lib/format'
import { packageRemaining } from '../../../lib/notifications'
import { FieldHint, FieldLabel } from '../../../components/FormHints'
import { Toast } from '../../../components/MediaUI'
import type {
  CustomerPackage,
  PackageUsage,
  Pet,
  ServicePackage,
  ShopCustomer,
} from '../../../lib/types'
import { userFacingError } from '../../../lib/userFacingError'

interface Props {
  shopId: string
}

export function PackagesTab({ shopId }: Props) {
  const [templates, setTemplates] = useState<ServicePackage[]>([])
  const [assigned, setAssigned] = useState<CustomerPackage[]>([])
  const [customers, setCustomers] = useState<ShopCustomer[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [usages, setUsages] = useState<PackageUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [tplName, setTplName] = useState('Pacote Banho')
  const [tplSessions, setTplSessions] = useState('10')
  const [tplPrice, setTplPrice] = useState('400')
  const [tplDays, setTplDays] = useState('90')

  const [assignPackageId, setAssignPackageId] = useState('')
  const [assignCustomerId, setAssignCustomerId] = useState('')
  const [assignPetId, setAssignPetId] = useState('')
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: t }, { data: a }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('service_packages').select('*').eq('shop_id', shopId).order('name'),
      supabase
        .from('customer_packages')
        .select('*, service_packages(*), pets(id,name,size,photo_url), shop_customers(id,name,phone)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false }),
      supabase.from('shop_customers').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('pets').select('*').eq('shop_id', shopId).order('name'),
    ])
    setTemplates((t as ServicePackage[]) || [])
    setAssigned((a as CustomerPackage[]) || [])
    setCustomers((c as ShopCustomer[]) || [])
    setPets((p as Pet[]) || [])
    if (!assignPackageId && (t || []).length > 0) setAssignPackageId(t![0].id)
    setLoading(false)
  }, [shopId, assignPackageId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selectedPkgId) {
      setUsages([])
      return
    }
    supabase
      .from('package_usages')
      .select('*')
      .eq('customer_package_id', selectedPkgId)
      .order('used_at', { ascending: false })
      .then(({ data }) => setUsages((data as PackageUsage[]) || []))
  }, [selectedPkgId])

  const petsForCustomer = useMemo(
    () => pets.filter((p) => p.customer_id === assignCustomerId),
    [pets, assignCustomerId]
  )

  const createTemplate = async () => {
    const sessions = Number(tplSessions)
    const price = Number(tplPrice)
    if (!tplName.trim() || !sessions || sessions < 1) {
      setToast('Informe o nome do pacote e a quantidade de sessões.')
      return
    }
    const { error } = await supabase.from('service_packages').insert({
      shop_id: shopId,
      name: tplName.trim(),
      total_sessions: sessions,
      price: Number.isFinite(price) ? price : 0,
      validity_days: tplDays ? Number(tplDays) : null,
      active: true,
    })
    if (error) {
      setToast(userFacingError(error, 'Não foi possível criar o modelo de pacote. Tente novamente.'))
      return
    }
    load()
  }

  const assignPackage = async () => {
    const tpl = templates.find((t) => t.id === assignPackageId)
    if (!tpl || !assignCustomerId || !assignPetId) {
      setToast('Selecione o pacote, o cliente e o pet.')
      return
    }
    let expires: string | null = null
    if (tpl.validity_days) {
      const d = new Date()
      d.setDate(d.getDate() + tpl.validity_days)
      expires = d.toISOString().slice(0, 10)
    }
    const { error } = await supabase.from('customer_packages').insert({
      shop_id: shopId,
      package_id: tpl.id,
      customer_id: assignCustomerId,
      pet_id: assignPetId,
      total_sessions: tpl.total_sessions,
      used_sessions: 0,
      expires_at: expires,
      status: 'active',
    })
    if (error) {
      setToast(userFacingError(error, 'Não foi possível associar o pacote. Tente novamente.'))
      return
    }
    setToast('Pacote associado ao pet com sucesso.')
    load()
  }

  const consumeOne = async (pkg: CustomerPackage) => {
    const { error } = await supabase.rpc('consume_package_session', {
      p_customer_package_id: pkg.id,
      p_booking_id: null,
      p_note: 'Uso manual',
    })
    if (error) {
      setToast(userFacingError(error, 'Não foi possível debitar a sessão. Tente novamente.'))
      return
    }
    setToast('Sessão debitada com sucesso.')
    setSelectedPkgId(pkg.id)
    load()
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  return (
    <div className="space-y-8">
      <Toast message={toast} onClose={() => setToast(null)} />
      <div>
        <h2 className="font-display text-2xl text-white mb-2">Pacotes</h2>
        <p className="text-sm text-charcoal-muted">
          Controle de banho de pacote: quantidade, restantes e histórico, sem contador inconsistente.
        </p>
      </div>

      <div className="rounded-lg border border-charcoal-light p-4 space-y-3">
        <h3 className="font-medium text-white">Novo modelo</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Nome</FieldLabel>
            <input
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white"
            />
          </div>
          <div>
            <FieldLabel>Sessões</FieldLabel>
            <input
              value={tplSessions}
              onChange={(e) => setTplSessions(e.target.value)}
              type="number"
              min={1}
              className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white"
            />
          </div>
          <div>
            <FieldLabel>Preço</FieldLabel>
            <input
              value={tplPrice}
              onChange={(e) => setTplPrice(e.target.value)}
              type="number"
              min={0}
              className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white"
            />
          </div>
          <div>
            <FieldLabel>Validade (dias)</FieldLabel>
            <input
              value={tplDays}
              onChange={(e) => setTplDays(e.target.value)}
              type="number"
              min={1}
              className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white"
            />
            <FieldHint>Deixe vazio se não expirar.</FieldHint>
          </div>
        </div>
        <button onClick={createTemplate} className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal">
          Criar modelo
        </button>
      </div>

      <div className="rounded-lg border border-charcoal-light p-4 space-y-3">
        <h3 className="font-medium text-white">Associar a cliente / pet</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={assignPackageId}
            onChange={(e) => setAssignPackageId(e.target.value)}
            className="rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white"
          >
            <option value="">Pacote</option>
            {templates.filter((t) => t.active).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.total_sessions}x)
              </option>
            ))}
          </select>
          <select
            value={assignCustomerId}
            onChange={(e) => {
              setAssignCustomerId(e.target.value)
              setAssignPetId('')
            }}
            className="rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white"
          >
            <option value="">Cliente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={assignPetId}
            onChange={(e) => setAssignPetId(e.target.value)}
            className="rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white"
          >
            <option value="">Pet</option>
            {petsForCustomer.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={assignPackage} className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal">
          Associar pacote
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium text-white">Pacotes ativos</h3>
        {assigned.length === 0 ? (
          <p className="text-charcoal-muted text-sm">Nenhum pacote associado.</p>
        ) : (
          assigned.map((pkg) => {
            const remaining = packageRemaining(pkg.total_sessions, pkg.used_sessions)
            return (
              <div key={pkg.id} className="rounded-lg border border-charcoal-light p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="text-white font-medium">
                      {pkg.service_packages?.name || 'Pacote'} · {pkg.pets?.name}
                    </p>
                    <p className="text-sm text-charcoal-muted">
                      {pkg.shop_customers?.name} · Restantes:{' '}
                      <span className="text-brass font-mono">
                        {remaining} de {pkg.total_sessions}
                      </span>
                      {pkg.expires_at && ` · Validade ${formatDate(pkg.expires_at)}`}
                    </p>
                    <p className="text-xs text-charcoal-muted mt-1 uppercase tracking-wide">{pkg.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedPkgId(pkg.id)}
                      className="rounded-lg border border-charcoal-light px-3 py-1.5 text-sm text-charcoal-muted hover:text-white"
                    >
                      Histórico
                    </button>
                    {pkg.status === 'active' && remaining > 0 && (
                      <button
                        onClick={() => consumeOne(pkg)}
                        className="rounded-lg bg-brass px-3 py-1.5 text-sm font-semibold text-charcoal"
                      >
                        Debitar 1
                      </button>
                    )}
                  </div>
                </div>
                {selectedPkgId === pkg.id && (
                  <div className="mt-3 border-t border-charcoal-light pt-3 space-y-2">
                    {usages.length === 0 ? (
                      <p className="text-sm text-charcoal-muted">Nenhum uso ainda.</p>
                    ) : (
                      usages.map((u) => (
                        <p key={u.id} className="text-sm text-charcoal-muted">
                          {formatDate(u.used_at.slice(0, 10))} · {u.note || 'utilizado'}
                          {u.booking_id ? ' · agendamento' : ''}
                        </p>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {templates.length > 0 && (
        <div>
          <h3 className="font-medium text-white mb-2">Modelos</h3>
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex justify-between rounded-lg bg-charcoal-light/30 px-4 py-3 text-sm"
              >
                <span className="text-white">
                  {t.name} · {t.total_sessions} sessões
                </span>
                <span className="font-mono text-brass">{formatPrice(Number(t.price))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
