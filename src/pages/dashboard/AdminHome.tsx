import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { invokeFunction } from '../../lib/supabase'

type ShopRow = {
  id: string
  name: string
  onboarding_completed: boolean
  subscription_status: string | null
  trial_ends_at: string | null
  created_at: string
}

export function AdminHome() {
  const [shops, setShops] = useState<ShopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'ready'>('all')

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const result = await invokeFunction<{shops: ShopRow[]}>('create-assisted-shop', {action:'overview'})
      setShops(result.shops)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as lojas.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [])
  const pending = shops.filter(s => !s.onboarding_completed).length
  const ready = shops.length - pending
  const trial = shops.filter(s => s.subscription_status === 'trial').length
  const visible = useMemo(() => shops.filter(s => {
    if (filter === 'pending' && s.onboarding_completed) return false
    if (filter === 'ready' && !s.onboarding_completed) return false
    return s.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
  }), [shops, search, filter])

  return <div className="mx-auto max-w-6xl space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">Administração da plataforma</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Visão geral</h1>
        <p className="mt-2 text-sm text-neutral-400">Gerencie as lojas do onefind em um só lugar.</p>
      </div>
      <Link to="/interno/nova" className="inline-flex items-center justify-center rounded-xl bg-brass px-5 py-3 font-semibold text-charcoal">+ Nova loja</Link>
    </div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {([{label:'Estabelecimentos',value:shops.length},{label:'Em configuração',value:pending},{label:'Configurados',value:ready},{label:'Em teste',value:trial}]).map(item=>
        <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs text-neutral-400">{item.label}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{loading?'—':item.value}</p>
        </div>)}
    </div>
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
        <div><h2 className="text-lg font-semibold text-white">Estabelecimentos</h2><p className="text-xs text-neutral-400">Até 100 lojas recentes</p></div>
        <button type="button" onClick={()=>void refresh()} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white">Atualizar</button>
      </div>
      <div className="flex flex-wrap gap-3 p-5">
        <input aria-label="Buscar estabelecimento" placeholder="Buscar loja..." value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-brass" />
        <select aria-label="Filtrar estabelecimentos" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} className="rounded-xl border border-white/15 bg-neutral-800 px-3 py-3 text-white"><option value="all">Todas</option><option value="pending">Pendentes</option><option value="ready">Configuradas</option></select>
      </div>
      {error && <p role="alert" className="mx-5 mb-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      {loading ? <p className="px-5 pb-6 text-sm text-neutral-400">Carregando lojas...</p> :
        visible.length === 0 ? <p className="px-5 pb-6 text-sm text-neutral-400">Nenhuma loja encontrada.</p> :
        <div className="divide-y divide-white/10">{visible.map(shop=>
          <div key={shop.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <Link to={`/interno/lojas/${encodeURIComponent(shop.id)}`} className="block truncate font-medium text-white hover:text-brass">{shop.name}</Link>
              <p className="mt-1 text-xs text-neutral-400">{shop.onboarding_completed?'Configuração concluída':'Configuração pendente'} · {shop.subscription_status||'Sem status de assinatura'}</p>
            </div>
            {!shop.onboarding_completed ? <Link to={`/interno/nova?shop=${encodeURIComponent(shop.id)}`} className="rounded-lg border border-brass/50 px-3 py-2 text-sm text-brass">Continuar</Link> : <Link to={`/interno/lojas/${encodeURIComponent(shop.id)}`} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-neutral-300">Ver detalhes</Link>}
          </div>)}</div>}
    </section>
  </div>
}
