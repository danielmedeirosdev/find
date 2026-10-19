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
  return <main className="mx-auto max-w-lg p-6 space-y-5">
    <h1 className="font-display text-3xl text-brass">Configuração assistida</h1>
    <p>Uso exclusivo do administrador. Crie apenas contas autorizadas pelos responsáveis.</p>
    <form onSubmit={create} className="space-y-4">
      <label className="block">Nome da loja<input className="block w-full p-3 bg-charcoal text-white" value={shopName} onChange={e => setShopName(e.target.value)} required /></label>
      <label className="block">E-mail do responsável<input className="block w-full p-3 bg-charcoal text-white" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <button disabled={busy} className="bg-brass text-charcoal p-3 rounded-lg">{busy ? 'Preparando...' : 'Criar loja e convite'}</button>
    </form>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {link && <div className="space-y-3">
      <p>Convite criado. Envie apenas ao responsável autorizado.</p>
      <button className="bg-brass text-charcoal p-3 rounded-lg" onClick={() => navigator.clipboard.writeText(message)}>Copiar mensagem para WhatsApp</button>
      <a className="block underline" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
    </div>}
  </main>
}
