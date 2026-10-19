import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, authErrorMessage } from '../../lib/supabase'
import { isPasswordStrong, PasswordRequirements } from '../../components/FormHints'

export function AccountSecurity() {
  const { user, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (loading) return <p>Carregando...</p>
  if (!user) return <Navigate to="/painel" replace />

  async function save(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!isPasswordStrong(password)) return setError('Escolha uma senha que atenda aos requisitos.')
    if (password !== confirm) return setError('As senhas não coincidem.')
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setPassword('')
      setConfirm('')
      setMessage('Senha alterada com sucesso.')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return <section className="mx-auto max-w-lg space-y-5 p-6">
    <h1 className="font-display text-3xl text-brass">Segurança da conta</h1>
    <p className="text-charcoal-muted">Defina uma nova senha para entrar no onefind.</p>
    <form onSubmit={save} className="space-y-4">
      <label className="block">Nova senha
        <input className="mt-2 w-full rounded-lg bg-charcoal border border-charcoal-light p-3 text-white" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required />
      </label>
      <PasswordRequirements password={password} />
      <label className="block">Confirmar nova senha
        <input className="mt-2 w-full rounded-lg bg-charcoal border border-charcoal-light p-3 text-white" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      </label>
      {error && <p role="alert" className="text-red-400">{error}</p>}
      {message && <p role="status" className="text-brass">{message}</p>}
      <button className="rounded-lg bg-brass px-5 py-3 font-semibold text-charcoal disabled:opacity-50" disabled={busy || !isPasswordStrong(password) || password !== confirm}>{busy ? 'Salvando...' : 'Alterar senha'}</button>
    </form>
  </section>
}
