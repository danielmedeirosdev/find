import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { authErrorMessage, isSupabaseConfigured, supabase } from '../../lib/supabase'
import { BrandAccent } from '../../components/BrandAccent'
import { FieldHint, FieldLabel, PasswordRequirements, isPasswordStrong } from '../../components/FormHints'

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!mounted) return
      if (data.session) setReady(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!isSupabaseConfigured) {
      setError('Configure o Supabase antes de redefinir a senha.')
      return
    }
    if (!isPasswordStrong(password)) {
      setError('A senha ainda não atende a todos os requisitos.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSuccess('Senha atualizada. Você já pode entrar normalmente.')
      window.setTimeout(() => navigate('/entrar', { replace: true }), 1800)
    } catch (err) {
      setError(authErrorMessage(err))
    }
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-4xl text-ink">Redefinir senha</h1>
      <BrandAccent className="mt-3 max-w-[6rem]" height="h-1" segment="platform" />
      <p className="mt-4 text-sm text-ink-muted">
        Escolha uma senha nova para a sua conta ONEFIND.
      </p>

      {!ready ? (
        <p className="mt-8 text-sm text-ink-muted">
          Abrindo o link de recuperação... Se esta tela permanecer assim, solicite um novo e-mail
          em Entrar.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <FieldLabel htmlFor="new-password">Nova senha</FieldLabel>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-ink"
              required
              autoComplete="new-password"
            />
            <PasswordRequirements password={password} />
          </div>
          <div>
            <FieldLabel htmlFor="confirm-password">Confirmar senha</FieldLabel>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-ink"
              required
              autoComplete="new-password"
            />
            <FieldHint>Repita a mesma senha.</FieldHint>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-brass">{success}</p>}
          <button
            type="submit"
            disabled={loading || !isPasswordStrong(password)}
            className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link to="/entrar" className="text-brass hover:underline">
          Voltar para entrar
        </Link>
      </p>
    </div>
  )
}
