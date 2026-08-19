import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase, authErrorMessage, isSupabaseConfigured } from '../../lib/supabase'
import { userFacingError } from '../../lib/userFacingError'
import { ensureAuthSession } from '../../lib/auth'
import { completeGoogleCredentialLogin } from '../../lib/oauth'
import { formatPhone } from '../../lib/format'
import { BrandAccent } from '../../components/BrandAccent'
import { BackArrow } from '../../components/SegmentMark'
import { AuthDivider, GoogleSignInButton } from '../../components/GoogleSignInButton'
import {
  FieldHint,
  FieldLabel,
  PasswordRequirements,
  isPasswordStrong,
} from '../../components/FormHints'
import { useAuth } from '../../contexts/AuthContext'

export function ClientAuth() {
  const location = useLocation()
  const isSignup = location.pathname === '/cadastro'
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  const [mode, setMode] = useState<'login' | 'signup'>(isSignup ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogleCredential = async (
    response: { credential: string },
    nonce: string
  ) => {
    setError('')
    setGoogleLoading(true)
    try {
      const result = await completeGoogleCredentialLogin('client', response, nonce)
      await refreshProfile()
      navigate(result.redirectTo)
    } catch (err) {
      setError(authErrorMessage(err))
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    if (!isSupabaseConfigured) {
      setError('O sistema está temporariamente indisponível. Tente novamente em instantes.')
      setLoading(false)
      return
    }

    try {
      if (mode === 'signup') {
        if (!isPasswordStrong(password)) {
          setError('A senha ainda não atende a todos os requisitos de segurança.')
          setLoading(false)
          return
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'client',
              name: name.trim(),
              phone: phone.replace(/\D/g, ''),
            },
          },
        })
        if (signUpError) {
          setError(authErrorMessage(signUpError))
          setLoading(false)
          return
        }
        if (!data.user) {
          setError('Não foi possível criar a conta. Tente novamente em instantes.')
          setLoading(false)
          return
        }

        try {
          await ensureAuthSession(email, password)
        } catch {
          setError(
            'Conta criada. Confirme o e-mail enviado para entrar. Verifique também a caixa de spam.'
          )
          setLoading(false)
          return
        }

        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle()

        if (!existingClient) {
          const { error: clientError } = await supabase.from('clients').insert({
            id: data.user.id,
            name: name.trim(),
            phone: phone.replace(/\D/g, ''),
          })
          if (clientError) {
            setError(userFacingError(clientError, 'Não foi possível concluir o cadastro. Tente novamente.'))
            setLoading(false)
            return
          }
        }

        await refreshProfile()
        navigate('/minhas-reservas')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setError(authErrorMessage(signInError))
          setLoading(false)
          return
        }
        await refreshProfile()
        navigate('/minhas-reservas')
      }
    } catch (err) {
      setError(authErrorMessage(err))
    }

    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl text-ink">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </h1>
        <BrandAccent className="mx-auto max-w-xs mt-4" segment="platform" />
        <p className="text-ink-muted mt-2 text-sm">
          Acompanhe seus horários em barbearias e pet shops.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-paper-dark bg-white p-6 space-y-4 shadow-sm">
        {mode === 'signup' && (
          <>
            <div>
              <FieldLabel tone="light">Nome</FieldLabel>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ex: Lucas Andrade"
                className="w-full rounded-lg border border-paper-dark px-4 py-2 placeholder:text-ink-muted/50 focus:border-brass focus:outline-none"
              />
            </div>
            <div>
              <FieldLabel tone="light">WhatsApp</FieldLabel>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="Ex: (11) 99999-9999"
                className="w-full rounded-lg border border-paper-dark px-4 py-2 placeholder:text-ink-muted/50 focus:border-brass focus:outline-none"
              />
              <FieldHint tone="light">
                Usado pelo estabelecimento para confirmar o horário e enviar lembretes.
              </FieldHint>
            </div>
          </>
        )}

        <div>
          <FieldLabel tone="light">E-mail</FieldLabel>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Ex: seuemail@gmail.com"
            className="w-full rounded-lg border border-paper-dark px-4 py-2 placeholder:text-ink-muted/50 focus:border-brass focus:outline-none"
          />
        </div>

        <div>
          <FieldLabel tone="light">Senha</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'signup' ? 8 : 6}
            placeholder={mode === 'signup' ? 'Crie uma senha forte' : 'Sua senha'}
            className="w-full rounded-lg border border-paper-dark px-4 py-2 placeholder:text-ink-muted/50 focus:border-brass focus:outline-none"
          />
          {mode === 'signup' && <PasswordRequirements password={password} tone="light" />}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-brass">{info}</p>}

        <button
          type="submit"
          disabled={loading || googleLoading || (mode === 'signup' && !isPasswordStrong(password))}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading
            ? 'Aguarde...'
            : mode === 'login'
              ? 'Entrar'
              : 'Criar conta'}
        </button>

        <AuthDivider tone="light" />

        <GoogleSignInButton
          tone="light"
          disabled={loading || googleLoading}
          onCredential={handleGoogleCredential}
          onError={(message) => {
            setError(message)
            setGoogleLoading(false)
          }}
        />
      </form>

      <p className="mt-4 text-center text-sm text-ink-muted">
        {mode === 'login' ? (
          <>
            Não tem conta?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError('')
                setInfo('')
              }}
              className="text-brass hover:underline"
            >
              Cadastre-se
            </button>
          </>
        ) : (
          <>
            Já tem conta?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
                setInfo('')
              }}
              className="text-brass hover:underline"
            >
              Entrar
            </button>
          </>
        )}
      </p>

      <p className="mt-4 text-center">
        <Link to="/" className="inline-flex items-center text-sm text-ink-muted hover:text-brass">
          <BackArrow />
          Voltar
        </Link>
      </p>
    </div>
  )
}
