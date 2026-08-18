import { useState } from 'react'
import { invokeFunction } from '../lib/supabase'
import { isPasswordStrong } from './FormHints'
import { userFacingError } from '../lib/userFacingError'
import type { Barber } from '../lib/types'

interface Props {
  barber: Barber
  onChanged: () => void
}

/**
 * Owner-only: create/reset staff panel login without sending email.
 * Credentials are shared offline (WhatsApp etc.).
 */
export function StaffAccessPanel({ barber, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const hasAccess = Boolean(barber.user_id)

  const provision = async () => {
    setError('')
    setSuccess('')
    if (!isPasswordStrong(password)) {
      setError('A senha precisa ter 8+ caracteres, maiúscula, minúscula e número.')
      return
    }
    setLoading(true)
    try {
      const result = await invokeFunction<{ message?: string; email?: string }>(
        'provision-staff-access',
        {
          action: 'provision',
          barber_id: barber.id,
          email: email.trim(),
          password,
        }
      )
      setSuccess(
        result.message ||
          'Acesso criado. Compartilhe e-mail e senha com o profissional (não enviamos e-mail).'
      )
      setPassword('')
      setOpen(false)
      onChanged()
    } catch (err) {
      setError(userFacingError(err, 'Não foi possível criar o acesso do profissional.'))
    }
    setLoading(false)
  }

  const revoke = async () => {
    if (!confirm('Remover o acesso deste profissional ao painel?')) return
    setRevoking(true)
    setError('')
    setSuccess('')
    try {
      await invokeFunction('provision-staff-access', {
        action: 'revoke',
        barber_id: barber.id,
      })
      setSuccess('Acesso removido.')
      onChanged()
    } catch (err) {
      setError(userFacingError(err, 'Não foi possível remover o acesso.'))
    }
    setRevoking(false)
  }

  return (
    <div className="mt-4 rounded-lg border border-charcoal-light/80 bg-charcoal/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-white">Acesso ao painel</p>
          <p className="text-xs text-charcoal-muted">
            {hasAccess
              ? 'Este profissional já pode entrar em /painel com o e-mail cadastrado.'
              : 'Crie login para o profissional ver só a própria agenda (sem financeiro/assinatura).'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v)
              setError('')
              setSuccess('')
            }}
            className="min-h-[40px] rounded-lg border border-brass/50 px-3 py-1.5 text-sm text-brass hover:bg-brass/10"
          >
            {hasAccess ? 'Redefinir senha' : 'Criar acesso'}
          </button>
          {hasAccess && (
            <button
              type="button"
              disabled={revoking}
              onClick={revoke}
              className="min-h-[40px] rounded-lg border border-red-400/40 px-3 py-1.5 text-sm text-red-400 disabled:opacity-50"
            >
              {revoking ? 'Removendo...' : 'Remover acesso'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-charcoal-light pt-3">
          <p className="text-xs text-charcoal-muted">
            Não enviamos e-mail. Anote a senha e envie pelo WhatsApp ao profissional.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail de acesso"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 text-sm text-white focus:border-brass focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha temporária forte"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2.5 text-sm text-white focus:border-brass focus:outline-none"
          />
          <button
            type="button"
            disabled={loading}
            onClick={provision}
            className="min-h-[44px] w-full rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal disabled:opacity-50 sm:w-auto"
          >
            {loading ? 'Salvando...' : hasAccess ? 'Atualizar acesso' : 'Criar acesso'}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {success && <p className="mt-2 text-sm text-brass">{success}</p>}
    </div>
  )
}
