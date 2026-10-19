import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, authErrorMessage } from '../lib/supabase'
import { isPasswordStrong, PasswordRequirements } from '../components/FormHints'

export function ActivateShop() {
  const [params] = useSearchParams()
  const started = useRef(false)
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const tokenHash = params.get('token_hash')
    // Remove the secret from the address bar and browser history immediately.
    window.history.replaceState(null, '', '/ativar')
    if (!tokenHash || !/^[a-f0-9]{32,128}$/i.test(tokenHash)) {
      setError('Este convite é inválido. Solicite outro link.')
      return
    }
    // An existing login must never be mistaken for the invited account.
    void (async () => {
      await supabase.auth.signOut()
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      if (verifyError || !data.user) {
        setError('O convite expirou ou já foi utilizado. Solicite outro link.')
        return
      }
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_user_id', data.user.id).maybeSingle()
      if (!shop) {
        await supabase.auth.signOut()
        setError('Este convite não corresponde a um estabelecimento.')
        return
      }
      setReady(true)
    })().catch(() => setError('Não foi possível validar o convite.'))
  }, [params])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!isPasswordStrong(password)) return setError('Crie uma senha que atenda aos requisitos.')
    if (password !== confirm) return setError('As senhas não coincidem.')
    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      navigate('/painel/dashboard', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally { setSaving(false) }
  }

  return <main className="mx-auto max-w-md px-4 py-16 space-y-5">
    <h1 className="font-display text-3xl">Ativar acesso ao onefind</h1>
    {!ready && !error && <p>Validando seu convite...</p>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {ready && <form onSubmit={submit} className="space-y-4">
      <p>Crie sua senha para acessar o painel do seu estabelecimento.</p>
      <label className="block">Nova senha<input type="password" autoComplete="new-password" required className="block w-full rounded border p-3" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <PasswordRequirements password={password} tone="light" />
      <label className="block">Confirmar senha<input type="password" autoComplete="new-password" required className="block w-full rounded border p-3" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      <button type="submit" disabled={saving || !isPasswordStrong(password) || password !== confirm} className="rounded bg-brass px-5 py-3 disabled:opacity-50">{saving ? 'Salvando...' : 'Ativar minha conta'}</button>
    </form>}
    <Link to="/painel" className="block underline">Voltar ao login</Link>
  </main>
}
