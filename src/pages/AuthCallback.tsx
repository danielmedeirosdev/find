import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { authErrorMessage, supabase } from '../lib/supabase'
import { finalizeOAuthLogin } from '../lib/oauth'
import { useAuth } from '../contexts/AuthContext'

async function waitForSession(timeoutMs = 8000): Promise<Session> {
  const existing = await supabase.auth.getSession()
  if (existing.data.session) return existing.data.session

  return await new Promise<Session>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      subscription.unsubscribe()
      reject(new Error('Não foi possível concluir o login com Google. Tente novamente.'))
    }, timeoutMs)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.clearTimeout(timer)
        subscription.unsubscribe()
        resolve(session)
      }
    })
  })
}

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { refreshProfile } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await waitForSession()
        if (cancelled) return

        const result = await finalizeOAuthLogin(searchParams.get('role'))
        if (cancelled) return

        await refreshProfile()
        navigate(result.redirectTo, { replace: true })
      } catch (err) {
        if (!cancelled) setError(authErrorMessage(err))
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [navigate, refreshProfile, searchParams])

  if (error) {
    return (
      <div className="mx-auto max-w-md text-center py-16 px-4">
        <h1 className="font-display text-3xl text-ink mb-3">Falha no login</h1>
        <p className="text-sm text-red-600 mb-6">{error}</p>
        <div className="flex flex-col gap-3 items-center">
          <Link to="/entrar" className="text-brass hover:underline text-sm">
            Voltar para entrar como cliente
          </Link>
          <Link to="/painel" className="text-ink-muted hover:text-brass text-sm">
            Área profissional
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md text-center py-16 px-4">
      <h1 className="font-display text-3xl text-ink mb-3">Entrando com Google</h1>
      <p className="text-sm text-ink-muted">Aguarde enquanto finalizamos seu acesso...</p>
    </div>
  )
}
