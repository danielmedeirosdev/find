import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { invokeFunction } from '../../lib/supabase'

export function AssistedSetup() {
  const { user, loading } = useAuth()
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (loading) return <p>Carregando...</p>
  if (!user) return <Navigate to="/painel" replace />
  if (user.app_metadata?.onefind_platform_admin !== true) return <Navigate to="/painel/dashboard" replace />

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!window.confirm('Confirma que o responsável autorizou a criação desta conta?')) return
    setBusy(true); setError(''); setLink('')
    try {
      const data = await invokeFunction<{ actionLink: string }>('create-assisted-shop', { shopName, email })
      setLink(data.actionLink)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o convite.')
    } finally { setBusy(false) }
  }
  const message = `Oi! Deixei sua loja preparada no onefind. Para ativar seu acesso e criar sua senha, abra este link: ${link}`
  return <section className="mx-auto max-w-lg space-y-6">
    <h1 className="text-2xl font-semibold tracking-tight text-white">Configuração assistida</h1>
    <p className="text-sm leading-relaxed text-neutral-400">Prepare o acesso de uma loja e envie o convite ao responsável.</p>
    <form onSubmit={create} className="space-y-5">
      <label className="block text-sm font-medium text-neutral-200">Nome da loja<input className="mt-2 block w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-neutral-500 focus:border-brass" value={shopName} onChange={e => setShopName(e.target.value)} required /></label>
      <label className="block">E-mail do responsável<input className="mt-2 block w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-neutral-500 focus:border-brass" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <button disabled={busy} className="rounded-xl bg-brass px-5 py-3 font-semibold text-charcoal transition hover:bg-brass-light disabled:opacity-50">{busy ? 'Preparando...' : 'Criar loja e convite'}</button>
    </form>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {link && <div className="space-y-3">
      <p>Convite criado. Envie apenas ao responsável autorizado.</p>
      <button className="bg-brass text-charcoal p-3 rounded-lg" onClick={() => navigator.clipboard.writeText(message)}>Copiar mensagem para WhatsApp</button>
      <a className="block underline" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
    </div>}
  </section>
}
