import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchReferralOverview,
  redeemReferralReward,
  referralPublicUrl,
  referralRewardLabel,
  referralStatusLabel,
  segmentLabel,
  shareMessage,
  whatsappShareUrl,
  type ReferralOverview,
} from '../../../lib/referral'
import type { Shop, ShopSegment } from '../../../lib/types'

interface Props {
  shop: Shop
  onUpdate?: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ReferralTab({ shop, onUpdate }: Props) {
  const segment: ShopSegment = shop.segment === 'pet' ? 'pet' : 'barbershop'
  const isPet = segment === 'pet'
  const [data, setData] = useState<ReferralOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [applyMessage, setApplyMessage] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const overview = await fetchReferralOverview()
      setData(overview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as indicações.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const link = data ? referralPublicUrl(data.code) : ''
  const displayLink = link.replace(/^https?:\/\//, '')
  const message = shareMessage(segment, link)
  const progressPct = data
    ? Math.min(100, Math.round((data.progress.current / Math.max(data.progress.target, 1)) * 100))
    : 0

  const availableRewards = useMemo(
    () => (data?.rewards || []).filter((r) => r.status === 'available'),
    [data]
  )

  const copyLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  const share = async () => {
    if (!link) return
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'ONEFIND', text: message, url: link })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    await copyLink()
  }

  const applyReward = async (id: string) => {
    setApplyingId(id)
    setApplyMessage('')
    try {
      await redeemReferralReward(id)
      setApplyMessage('Recompensa aplicada à sua assinatura.')
      await load()
      onUpdate?.()
    } catch (err) {
      setApplyMessage(err instanceof Error ? err.message : 'Não foi possível aplicar a recompensa.')
    }
    setApplyingId(null)
  }

  if (loading) return <p className="text-charcoal-muted">Carregando indicações...</p>

  if (error && !data) {
    return (
      <div>
        <h2 className="font-display text-2xl text-white mb-2">Indique e ganhe</h2>
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            load()
          }}
          className="mt-4 rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:text-white"
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-white mb-2">Indique e ganhe</h2>
        <p className="text-sm text-charcoal-muted max-w-2xl">
          Ajude outros negócios a crescerem com o ONEFIND e ganhe benefícios por cada indicação
          convertida.
        </p>
        <p className="mt-2 text-xs text-charcoal-muted">
          {isPet
            ? 'Indique outro pet shop. A recompensa só é liberada quando a empresa assinar de verdade.'
            : 'Indique outra barbearia. A recompensa só é liberada quando a empresa assinar de verdade.'}
        </p>
      </div>

      <section className="rounded-xl border border-charcoal-light bg-charcoal-light/20 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-widest text-brass/80">Seu link de indicação</p>
        <p className="mt-2 break-all font-mono text-sm text-white sm:text-base">{displayLink}</p>
        <p className="mt-1 text-xs text-charcoal-muted">Código {data.code}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal"
          >
            {copied ? 'Link copiado!' : 'Copiar link'}
          </button>
          <a
            href={whatsappShareUrl(message)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white"
          >
            WhatsApp
          </a>
          <button
            type="button"
            onClick={share}
            className="rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white"
          >
            Compartilhar
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Indicações enviadas" value={data.stats.sent} />
        <Stat label="Em teste" value={data.stats.trial} />
        <Stat label="Convertidas" value={data.stats.converted} />
        <Stat label="Meses gratuitos disponíveis" value={data.stats.months_available} highlight />
      </section>

      <section className="rounded-xl border border-charcoal-light p-5">
        <p className="text-xs uppercase tracking-widest text-charcoal-muted">Próxima recompensa</p>
        <p className="mt-2 text-white">
          <span className="font-display text-2xl text-brass">{data.progress.current}</span>
          <span className="text-charcoal-muted"> de {data.progress.target} indicações</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-charcoal-light">
          <div
            className="h-full rounded-full bg-brass transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-charcoal-muted">
          {data.progress.remaining === 0
            ? 'Você já desbloqueou 3 meses grátis neste ciclo. Continue indicando para acumular mais.'
            : data.progress.remaining === 1
              ? 'Falta 1 indicação convertida para desbloquear 3 meses grátis.'
              : `Faltam ${data.progress.remaining} indicações convertidas para desbloquear 3 meses grátis.`}
        </p>
      </section>

      {availableRewards.length > 0 && (
        <section className="rounded-xl border border-brass/40 bg-brass/5 p-5">
          <h3 className="font-medium text-white">Recompensas disponíveis</h3>
          <ul className="mt-3 space-y-3">
            {availableRewards.map((reward) => (
              <li
                key={reward.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-charcoal-light px-4 py-3"
              >
                <p className="text-sm text-white">
                  {reward.months} {reward.months === 1 ? 'mês grátis' : 'meses grátis'}
                </p>
                <button
                  type="button"
                  disabled={applyingId === reward.id}
                  onClick={() => applyReward(reward.id)}
                  className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal disabled:opacity-50"
                >
                  {applyingId === reward.id ? 'Aplicando...' : 'Aplicar à minha assinatura'}
                </button>
              </li>
            ))}
          </ul>
          {applyMessage && <p className="mt-3 text-sm text-brass">{applyMessage}</p>}
        </section>
      )}

      <section>
        <h3 className="font-medium text-white mb-3">Minhas indicações</h3>
        {data.referrals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-charcoal-light px-5 py-10 text-center">
            <p className="text-white">Ainda não há indicações</p>
            <p className="mt-1 text-sm text-charcoal-muted">
              Compartilhe seu link exclusivo e comece a ganhar benefícios.
            </p>
            <button
              type="button"
              onClick={copyLink}
              className="mt-4 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal"
            >
              {copied ? 'Link copiado!' : 'Copiar meu link'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-charcoal-light">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-charcoal-light text-xs uppercase tracking-wider text-charcoal-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Segmento</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Recompensa</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((row) => (
                  <tr key={row.id} className="border-t border-charcoal-light/70">
                    <td className="px-4 py-3 text-white">{row.company}</td>
                    <td className="px-4 py-3 text-charcoal-muted">{segmentLabel(String(row.segment))}</td>
                    <td className="px-4 py-3 text-charcoal-muted whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-charcoal-muted">{referralStatusLabel(row)}</td>
                    <td className="px-4 py-3 text-charcoal-muted">{referralRewardLabel(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-charcoal-light px-4 py-4">
      <p className="text-xs text-charcoal-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl ${highlight ? 'text-brass' : 'text-white'}`}>{value}</p>
    </div>
  )
}
