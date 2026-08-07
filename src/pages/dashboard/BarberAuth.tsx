import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, authErrorMessage, isSupabaseConfigured } from '../../lib/supabase'
import { ensureAuthSession, ensureBarberShop } from '../../lib/auth'
import { BarberPole } from '../../components/BarberPole'
import {
  FieldHint,
  FieldLabel,
  PasswordRequirements,
  isPasswordStrong,
} from '../../components/FormHints'

export function BarberAuth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopName, setShopName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!isSupabaseConfigured) {
      setError('Configure o Supabase no arquivo .env antes de criar conta.')
      setLoading(false)
      return
    }

    try {
      if (mode === 'signup') {
        if (!isPasswordStrong(password)) {
          setError('A senha ainda não atende a todos os requisitos.')
          setLoading(false)
          return
        }

        const shopNameValue = shopName.trim() || 'Minha Barbearia'

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'barber',
              shop_name: shopNameValue,
            },
          },
        })
        if (signUpError) {
          setError(signUpError.message)
          setLoading(false)
          return
        }
        if (!data.user) {
          setError('Não foi possível criar a conta.')
          setLoading(false)
          return
        }

        try {
          await ensureAuthSession(email, password)
        } catch {
          setError(
            'Conta criada! Confirme seu e-mail e faça login. (Ou desative "Confirm email" no Supabase → Authentication → Email)'
          )
          setLoading(false)
          return
        }

        try {
          await ensureBarberShop(data.user.id, shopNameValue)
        } catch (shopError) {
          setError(
            shopError instanceof Error
              ? shopError.message
              : 'Erro ao criar barbearia. Rode o SQL 002_signup_trigger.sql no Supabase.'
          )
          setLoading(false)
          return
        }

        navigate('/painel/dashboard')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setError(signInError.message)
          setLoading(false)
          return
        }
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: shop } = await supabase
            .from('shops')
            .select('id')
            .eq('owner_user_id', user.id)
            .maybeSingle()
          if (!shop) {
            await ensureBarberShop(user.id, 'Minha Barbearia')
          }
        }
        navigate('/painel/dashboard')
      }
    } catch (err) {
      setError(authErrorMessage(err))
    }

    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl text-brass">
          {mode === 'login' ? 'Área do Barbeiro' : 'Cadastrar Barbearia'}
        </h1>
        <BarberPole className="mx-auto max-w-xs mt-4" />
        <p className="text-charcoal-muted mt-2 text-sm">
          Gerencie sua barbearia e receba agendamentos online.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-charcoal-light bg-charcoal-light/30 p-6 space-y-4"
      >
        {mode === 'signup' && (
          <div>
            <FieldLabel>Nome da barbearia</FieldLabel>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
              placeholder="Ex: Barbearia Black Crown"
              className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
            />
            <FieldHint>Aparece no painel e na página pública dos clientes.</FieldHint>
          </div>
        )}

        <div>
          <FieldLabel>E-mail</FieldLabel>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Ex: contato@barbearia.com"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
          <FieldHint>Usado para entrar no painel e receber avisos da assinatura.</FieldHint>
        </div>

        <div>
          <FieldLabel>Senha</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'signup' ? 8 : 6}
            placeholder={mode === 'signup' ? 'Crie uma senha forte' : 'Sua senha'}
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
          {mode === 'signup' && <PasswordRequirements password={password} />}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || (mode === 'signup' && !isPasswordStrong(password))}
          className="w-full rounded-lg bg-brass py-3 font-semibold text-charcoal disabled:opacity-50"
        >
          {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar barbearia'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-charcoal-muted">
        {mode === 'login' ? (
          <>
            Primeira vez?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError('')
              }}
              className="text-brass hover:underline"
            >
              Cadastre sua barbearia
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
              }}
              className="text-brass hover:underline"
            >
              Entrar
            </button>
          </>
        )}
      </p>

      <p className="mt-4 text-center">
        <Link to="/" className="text-sm text-charcoal-muted hover:text-brass">
          ← Voltar ao site
        </Link>
      </p>
    </div>
  )
}
