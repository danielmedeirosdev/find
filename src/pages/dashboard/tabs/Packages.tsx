import { Modal } from '../../../components/Modal'
import { customerLabel } from '../../../lib/format'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [assigning,setAssigning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [tplName, setTplName] = useState('Pacote Banho')
  const [tplSessions, setTplSessions] = useState('10')
  const [tplPrice, setTplPrice] = useState('400')
  const [tplDays, setTplDays] = useState('90')

  const assignmentId=useRef(crypto.randomUUID())
  const [saleMode,setSaleMode]=useState('pending')
  const [paymentMethod,setPaymentMethod]=useState('pix')
  const [balances,setBalances]=useState<{package_id:string;total:number;received:number;balance:number}[]>([])
  const [receiving,setReceiving]=useState<string|null>(null)
  const [receiveAmount,setReceiveAmount]=useState('')
  const [receiveMethod,setReceiveMethod]=useState('pix')
  const [receiveId,setReceiveId]=useState('')
  const [receivingBusy,setReceivingBusy]=useState(false)
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
    const balanceResult=await supabase.rpc('package_balances',{p_shop_id:shopId})
    if(balanceResult.error)setToast('Não foi possível carregar os saldos dos pacotes.');else setBalances(balanceResult.data||[])
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

  const editTemplate = (tpl: ServicePackage) => {
    setEditingTemplateId(tpl.id)
    setTplName(tpl.name)
    setTplSessions(String(tpl.total_sessions))
    setTplPrice(String(tpl.price))
    setTplDays(tpl.validity_days == null ? '' : String(tpl.validity_days))
  }

  const cancelEdit = () => {
    setEditingTemplateId(null)
    setTplName('Pacote Banho')
    setTplSessions('10')
    setTplPrice('400')
    setTplDays('90')
  }

  const createTemplate = async () => {
    const sessions = Number(tplSessions)
    const price = Number(tplPrice)
    if (!tplName.trim() || !Number.isInteger(sessions) || sessions < 1 || !Number.isFinite(price) || price < 0 || (tplDays !== '' && (!Number.isInteger(Number(tplDays)) || Number(tplDays) < 1))) {
      setToast('Informe nome e quantidade de sessões.')
      return
    }
    setSavingTemplate(true)
    const values = {
      name: tplName.trim(),
      total_sessions: sessions,
      price,
      validity_days: tplDays ? Number(tplDays) : null,
    }
    const { error } = editingTemplateId
      ? await supabase.from('service_packages').update(values).eq('id', editingTemplateId).eq('shop_id', shopId)
      : await supabase.from('service_packages').insert({ ...values, shop_id: shopId, active: true })
    setSavingTemplate(false)
    if (error) {
      setToast(error.message)
      return
    }
    setToast(editingTemplateId ? 'Modelo de pacote atualizado.' : 'Modelo de pacote criado.')
    cancelEdit()
    load()
  }

  const assignPackage = async () => {
    if(assigning)return
    const tpl = templates.find((t) => t.id === assignPackageId)
    if (!tpl || !assignCustomerId || !assignPetId) {
      setToast('Selecione pacote, cliente e pet.')
      return
    }
    setAssigning(true)
    const base={p_id:assignmentId.current,p_shop_id:shopId,p_template_id:tpl.id,p_customer_id:assignCustomerId,p_pet_id:assignPetId}
    const {error}=saleMode==='legacy' ? await supabase.rpc('assign_operational_package',{...base,p_record_payment:false}) : await supabase.rpc('sell_customer_package',{...base,p_paid_now:saleMode==='paid',p_method:saleMode==='paid'?paymentMethod:null})
    if (error) {
      setAssigning(false)
      setToast(error.message)
      return
    }
    setAssigning(false)
    assignmentId.current=crypto.randomUUID()
    setToast('Pacote associado ao pet.')
    load()
  }

  const [editingAssignedId, setEditingAssignedId] = useState<string | null>(null)
  const [assignedSessions, setAssignedSessions] = useState('')
  const [assignedUsed, setAssignedUsed] = useState('')
  const [assignedExpiry, setAssignedExpiry] = useState('')
  const [savingAssigned, setSavingAssigned] = useState(false)

  const editAssigned = (pkg: CustomerPackage) => {
    setEditingAssignedId(pkg.id)
    setAssignedSessions(String(pkg.total_sessions))
    setAssignedUsed(String(pkg.used_sessions))
    setAssignedExpiry(pkg.expires_at || '')
  }

  const saveAssigned = async (pkg: CustomerPackage) => {
    const total = Number(assignedSessions)
    const used = Number(assignedUsed)
    if (!Number.isInteger(total) || total < 1 || !Number.isInteger(used) || used < 0 || used > total) {
      setToast('Confira as sessões totais e utilizadas.')
      return
    }
    setSavingAssigned(true)
    const { error } = await supabase.from('customer_packages')
      .update({ total_sessions: total, used_sessions: used, expires_at: assignedExpiry || null, status: used >= total ? 'exhausted' : assignedExpiry && assignedExpiry < new Date().toLocaleDateString('en-CA') ? 'expired' : 'active' })
      .eq('id', pkg.id).eq('shop_id', shopId)
    setSavingAssigned(false)
    if (error) { setToast(error.message); return }
    setEditingAssignedId(null)
    setToast('Pacote ativo atualizado.')
    load()
  }

  const consumeOne = async (pkg: CustomerPackage) => {
    const { error } = await supabase.rpc('consume_package_session', {
      p_customer_package_id: pkg.id,
      p_booking_id: null,
      p_note: 'Uso manual',
    })
    if (error) {
      setToast(error.message)
      return
    }
    setToast('Sessão debitada.')
    setSelectedPkgId(pkg.id)
    load()
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  return (
    <div className="space-y-8">
      {receiving&&<Modal label="Receber pacote" onClose={()=>setReceiving(null)} busy={receivingBusy} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3"><div className="w-full max-w-md space-y-3 rounded-xl bg-charcoal p-4"><h3 className="text-lg text-white">Receber pacote</h3><label className="block text-sm text-white">Valor recebido (R$)<input className="min-h-11 w-full rounded-lg bg-charcoal-dark p-3" inputMode="decimal" value={receiveAmount} onChange={e=>{setReceiveAmount(e.target.value);setReceiveId(crypto.randomUUID())}}/></label><label className="block text-sm text-white">Forma de pagamento<select className="min-h-11 w-full rounded-lg bg-charcoal-dark p-3" value={receiveMethod} onChange={e=>{setReceiveMethod(e.target.value);setReceiveId(crypto.randomUUID())}}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option></select></label><div className="grid grid-cols-2 gap-2"><button disabled={receivingBusy} className="min-h-11 text-white" onClick={()=>setReceiving(null)}>Cancelar</button><button disabled={receivingBusy} className="min-h-11 rounded-lg bg-brass text-charcoal" onClick={async()=>{const amount=Number(receiveAmount.replace(',','.'));if(!Number.isFinite(amount)||amount<=0){setToast('Informe um valor válido.');return}setReceivingBusy(true);const r=await supabase.rpc('receive_package_payment',{p_package_id:receiving,p_amount:amount,p_method:receiveMethod,p_request_id:receiveId});if(r.error){setReceivingBusy(false);setToast(r.error.message);return}await load();setReceivingBusy(false);setReceiving(null)}}>{receivingBusy?'Salvando...':'Registrar recebimento'}</button></div></div></Modal>}
      <Toast message={toast} onClose={() => setToast(null)} />
      <div>
        <h2 className="font-display text-2xl text-white mb-2">Pacotes</h2>
        <p className="text-sm text-charcoal-muted">
          Controle de banho de pacote: quantidade, restantes e histórico, sem contador inconsistente.
        </p>
      </div>

      <div className="rounded-lg border border-charcoal-light p-4 space-y-3">
        <h3 className="font-medium text-white">{editingTemplateId ? 'Editar modelo de pacote' : 'Novo modelo'}</h3>
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
        <div className="flex flex-wrap gap-2">
          <button onClick={createTemplate} disabled={savingTemplate} className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal disabled:opacity-50">
            {savingTemplate ? 'Salvando...' : editingTemplateId ? 'Salvar alterações' : 'Criar modelo'}
          </button>
          {editingTemplateId && <button onClick={cancelEdit} className="rounded-lg border border-charcoal-light px-4 py-2 text-white">Cancelar</button>}
        </div>
        {editingTemplateId && <p className="text-xs text-charcoal-muted">Alterações no modelo não modificam sessões já utilizadas ou a validade de pacotes anteriormente associados.</p>}
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
                {customerLabel(c)}
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
        <label className="block text-sm text-white">Registro financeiro<select className="mt-2 min-h-11 w-full rounded-lg bg-charcoal px-3 text-white" value={saleMode} onChange={e=>setSaleMode(e.target.value)}><option value="pending">Nova venda — receber depois</option><option value="paid">Nova venda — pagamento recebido agora</option><option value="legacy">Pacote antigo já pago — somente sessões</option></select></label>{saleMode==='paid'&&<label className="block text-sm text-white">Forma de pagamento<select className="min-h-11 w-full rounded-lg bg-charcoal px-3" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option></select></label>}<p className="text-xs text-charcoal-muted">A nova venda registra o valor devido. Somente pagamentos recebidos entram no caixa. Pacotes antigos não geram nova venda nem dívida.</p><button disabled={assigning} onClick={assignPackage} className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal">
          Associar pacote
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3"><p className="text-sm text-white">Vendido: {formatPrice(balances.reduce((v,b)=>v+Number(b.total),0))}</p><p className="text-sm text-white">Recebido: {formatPrice(balances.reduce((v,b)=>v+Number(b.received),0))}</p><p className="text-sm text-brass">A receber: {formatPrice(balances.reduce((v,b)=>v+Number(b.balance),0))}</p></div><p className="text-xs text-charcoal-muted">Valores das vendas registradas a partir desta atualização. Pacotes antigos permanecem sem reclassificação.</p>
        <h3 className="font-medium text-white">Pacotes ativos</h3>
        {assigned.length === 0 ? (
          <p className="text-charcoal-muted text-sm">Nenhum pacote associado.</p>
        ) : (
          assigned.map((pkg) => {
            const balance=balances.find(b=>b.package_id===pkg.id)
            const remaining = packageRemaining(pkg.total_sessions, pkg.used_sessions)
            return (
              <div key={pkg.id} className="rounded-lg border border-charcoal-light p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="text-white font-medium">
                      {pkg.service_packages?.name || 'Pacote'} · {pkg.pets?.name}
                    </p>
                    <p className="text-sm text-charcoal-muted">
                      {customerLabel(pkg.shop_customers)} · Restantes:{' '}
                      <span className="text-brass font-mono">
                        {remaining} de {pkg.total_sessions}
                      </span>
                      {pkg.expires_at && ` · Validade ${formatDate(pkg.expires_at)}`}
                    </p>
                    <p className="text-xs text-charcoal-muted mt-1 uppercase tracking-wide">{pkg.status}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {balance&&<p className="w-full text-sm text-brass">{Number(balance.balance)>0?`Pendente ${formatPrice(Number(balance.balance))}`:'Quitado'} · Recebido {formatPrice(Number(balance.received))}</p>}
                    {balance&&Number(balance.balance)>0&&<button className="min-h-11 rounded-lg bg-brass px-3 text-sm text-charcoal" onClick={()=>{setReceiving(pkg.id);setReceiveAmount(Number(balance.balance).toFixed(2).replace('.',','));setReceiveMethod('pix');setReceiveId(crypto.randomUUID())}}>Receber pacote</button>}
                    <button onClick={() => editAssigned(pkg)} className="rounded-lg border border-brass px-3 py-1.5 text-sm text-brass">Editar</button>
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
                {editingAssignedId === pkg.id && (
                  <div className="mt-3 border-t border-charcoal-light pt-3 space-y-3">
                    <p className="text-sm text-white">Editar pacote ativo</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-sm text-charcoal-muted">Total de sessões<input type="number" min="1" value={assignedSessions} onChange={e => setAssignedSessions(e.target.value)} className="mt-1 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white" /></label>
                      <label className="text-sm text-charcoal-muted">Sessões utilizadas<input type="number" readOnly min="0" value={assignedUsed} onChange={e => setAssignedUsed(e.target.value)} className="mt-1 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white" /></label>
                      <label className="text-sm text-charcoal-muted">Validade<input type="date" value={assignedExpiry} onChange={e => setAssignedExpiry(e.target.value)} className="mt-1 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white" /></label>
                    </div>
                    <p className="text-xs text-charcoal-muted">As sessões utilizadas são preservadas pelo histórico. Você pode alterar o total de sessões e a validade.</p>
                    <div className="flex gap-2">
                      <button disabled={savingAssigned} onClick={() => saveAssigned(pkg)} className="rounded-lg bg-brass px-3 py-2 text-sm font-semibold text-charcoal disabled:opacity-50">Salvar alterações</button>
                      <button onClick={() => setEditingAssignedId(null)} className="rounded-lg border border-charcoal-light px-3 py-2 text-sm text-white">Cancelar</button>
                    </div>
                  </div>
                )}
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
                <div className="flex items-center gap-3">
                  <span className="font-mono text-brass">{formatPrice(Number(t.price))}</span>
                  <button onClick={() => editTemplate(t)} className="rounded-lg border border-charcoal-light px-3 py-1 text-white hover:border-brass">Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
