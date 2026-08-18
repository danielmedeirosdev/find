import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, authErrorMessage, isSupabaseConfigured } from '../../lib/supabase'
import { ensureAuthSession, ensureBarberShop } from '../../lib/auth'
import { completeGoogleCredentialLogin } from '../../lib/oauth'
import { getSegment, parseSegmentParam, ACTIVE_SEGMENTS, SEGMENTS } from '../../lib/segments'
import { BrandAccent } from '../../components/BrandAccent'
import { AuthDivider, GoogleSignInButton } from '../../components/GoogleSignInButton'
import { SegmentMark, BackArrow } from '../../components/SegmentMark'
import {
  FieldHint,
  FieldLabel,
  PasswordRequirements,
  isPasswordStrong,
} from '../../components/FormHints'
import { useAuth } from '../../contexts/AuthContext'
import type { ShopSegment } from '../../lib/types'
import { readStoredReferralCode } from '../../lib/referral'
import { requestPasswordReset } from '../../lib/passwordReset'

export function BarberAuth() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopName, setShopName] = useState('')
  const [segment, setSegment] = useState<ShopSegment>('barbershop')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/painel/dashboard', { replace: true })
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    const fromUrl = parseSegmentParam(searchParams.get('segment'))
    if (fromUrl) setSegment(fromUrl)
    if (searchParams.get('modo') === 'cadastro') setMode('signup')
  }, [searchParams])

  const selectSegment = (id: ShopSegment) => {
    setSegment(id)
    const next = new URLSearchParams(searchParams)
    next.set('segment', id)
    if (mode === 'signup') next.set('modo', 'cadastro')
    setSearchParams(next, { replace: true })
  }

  const meta = getSegment(segment)
  const defaultShopName = meta.defaultShopName

  if (authLoading || user) {
    return <p className="text-center text-charcoal-muted">Carregando...</p>
  }

  const handleGoogleCredential = async (
    response: { credential: string },
    nonce: string
  ) => {
    setError('')
    if (mode === 'signup' && !shopName.trim()) {
      setError('Informe o nome do estabelecimento antes de continuar com Google.')
      return
    }
    setGoogleLoading(true)
    try {
      const result = await completeGoogleCredentialLogin(
        'barber',
        response,
        nonce,
        shopName.trim() || defaultShopName,
        segment
      )
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
      setError('Configure o Supabase no arquivo .env antes de criar conta.')
      setLoading(false)
      return
    }

    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email)
        setInfo('Se este e-mail existir, enviamos um link para redefinir a senha.')
        setLoading(false)
        return
      }

      if (mode === 'signup') {
        if (!isPasswordStrong(password)) {
          setError('A senha ainda não atende a todos os requisitos.')
          setLoading(false)
          return
        }

        const shopNameValue = shopName.trim() || defaultShopName
        const referralCode = readStoredReferralCode()

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'barber',
              shop_name: shopNameValue,
              segment,
              ...(referralCode ? { referral_code: referralCode } : {}),
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
          await ensureBarberShop(data.user.id, shopNameValue, segment)
        } catch (shopError) {
          setError(
            shopError instanceof Error
              ? shopError.message
              : 'Erro ao criar estabelecimento. Rode o SQL 002_signup_trigger.sql no Supabase.'
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
            .select('id, segment, name')
            .eq('owner_user_id', user.id)
            .maybeSingle()
          if (!shop) {
            await ensureBarberShop(user.id, defaultShopName, segment)
          } else {
            // Preserva PET existente; só força PET quando o fluxo atual é PET
            // (corrige lojas criadas pelo trigger antigo como barbershop).
            const intended: ShopSegment =
              segment === 'pet' || shop.segment === 'pet' ? 'pet' : 'barbershop'
            await ensureBarberShop(user.id, shop.name || defaultShopName, intended)
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
        <p className="text-xs uppercase tracking-[0.3em] text-brass mb-2">FIND</p>
        <h1 className="font-display text-4xl text-brass">
          {mode === 'login' ? 'Área do profissional' : 'Criar profissional'}
        </h1>
        <BrandAccent className="mx-auto max-w-xs mt-4" segment={segment} />
        <p className="text-charcoal-muted mt-2 text-sm">{meta.description}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-charcoal-light bg-charcoal-light/30 p-6 space-y-4"
      >
        {mode === 'signup' && (
          <>
            <div>
              <FieldLabel>Qual é o seu negócio?</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {ACTIVE_SEGMENTS.map((id) => {
                  const s = SEGMENTS[id]
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectSegment(id)}
                      className={`rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                        segment === id
                          ? 'bg-brass text-charcoal'
                          : 'border border-charcoal-light text-charcoal-muted hover:text-white'
                      }`}
                    >
                      <span className="mb-1 flex justify-center" aria-hidden>
                        <SegmentMark segment={s.mark} className="h-6 w-6" />
                      </span>
                      {s.shortName}
                    </button>
                  )
                })}
              </div>
              <FieldHint>
                O FIND configura automaticamente dashboard, serviços iniciais e regras do segmento.
              </FieldHint>
            </div>

            <div>
              <FieldLabel>Nome do estabelecimento</FieldLabel>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
                placeholder={meta.namePlaceholder}
                className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
              />
              <FieldHint>Aparece no painel e na página pública dos clientes.</FieldHint>
            </div>
          </>
        )}

        <div>
          <FieldLabel>E-mail</FieldLabel>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Ex: contato@negocio.com"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
          <FieldHint>Usado para entrar no painel e receber avisos da assinatura.</FieldHint>
        </div>

        {mode !== 'forgot' && (
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
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setError('')
                  setInfo('')
                }}
                className="mt-2 text-xs text-brass hover:underline"
              >
                Esqueci minha senha
              </button>
            )}
          </div>
        )}

        {mode === 'forgot' && (
          <p className="text-sm text-charcoal-muted">
            Enviaremos um link para o e-mail da conta. Depois você cria uma senha nova.
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-brass">{info}</p>}

        <button
          type="submit"
          disabled={loading || googleLoading || (mode === 'signup' && !isPasswordStrong(password))}
          className="w-full rounded-lg bg-brass py-3 font-semibold text-charcoal disabled:opacity-50"
        >
          {loading
            ? 'Aguarde...'
            : mode === 'login'
              ? 'Entrar'
              : mode === 'forgot'
                ? 'Enviar link de recuperação'
                : 'Criar conta'}
        </button>

        {mode !== 'forgot' && (
          <>
            <AuthDivider tone="dark" />

            <GoogleSignInButton
              tone="dark"
              disabled={loading || googleLoading}
              onCredential={handleGoogleCredential}
              onError={(message) => {
                setError(message)
                setGoogleLoading(false)
              }}
            />
          </>
        )}
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
                setInfo('')
              }}
              className="text-brass hover:underline"
            >
              Cadastre seu negócio
            </button>
          </>
        ) : mode === 'forgot' ? (
          <>
            Lembrou a senha?{' '}
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
        <Link to="/" className="inline-flex items-center text-sm text-charcoal-muted hover:text-brass">
          <BackArrow />
          Voltar ao FIND
        </Link>
      </p>
    </div>
  )
}
