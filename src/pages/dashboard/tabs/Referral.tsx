import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyReferralReward,
  fetchReferralOverview,
  referralPublicUrl,
  referralRewardLabel,
  referralStatusLabel,
  segmentLabel,
  shareMessage,
  whatsappShareUrl,
  type ReferralOverview,
  type ReferralRewardRow,
} from '../../../lib/referral'
import type { Shop, ShopSegment } from '../../../lib/types'

interface Props {
  shop: Shop
  onUpdate?: () => void
}

function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function monthsLabel(months: number) {
  return months === 1 ? '1 mês grátis' : `${months} meses grátis`
}

function appliedCopy(reward: ReferralRewardRow) {
  if (reward.applied_via === 'trial_extension') {
    return `${monthsLabel(reward.months)} aplicado ao seu período de testes. Quando você assinar, a primeira cobrança já considera este benefício.`
  }
  if (reward.next_charge_on) {
    return `${monthsLabel(reward.months)} aplicado à sua assinatura. Próxima cobrança em ${formatDate(reward.next_charge_on)}.`
  }
  return `${monthsLabel(reward.months)} aplicado à sua assinatura.`
}

export function ReferralTab({ shop, onUpdate }: Props) {
  const segment: ShopSegment = shop.segment === 'pet' ? 'pet' : 'barbershop'
  const isPet = segment === 'pet'
  const [data, setData] = useState<ReferralOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [applyError, setApplyError] = useState('')
  const [applySuccess, setApplySuccess] = useState('')

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
  const appliedRewards = useMemo(
    () => (data?.rewards || []).filter((r) => r.status === 'redeemed'),
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

  const applyReward = async (reward: ReferralRewardRow) => {
    setApplyingId(reward.id)
    setConfirmingId(null)
    setApplyError('')
    setApplySuccess('')
    try {
      const result = await applyReferralReward(reward.id)
      const via = result.applied_via === 'trial_extension' ? 'trial_extension' : 'asaas_postpone'
      setApplySuccess(
        appliedCopy({
          ...reward,
          status: 'redeemed',
          applied_via: result.applied_via ?? via,
          next_charge_on: result.next_charge_on ?? null,
        })
      )
      await load()
      onUpdate?.()
    } catch {
      setApplyError('Não foi possível aplicar seu benefício. Tente novamente.')
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
            {availableRewards.map((reward) => {
              const applying = applyingId === reward.id
              const confirming = confirmingId === reward.id
              return (
                <li
                  key={reward.id}
                  className="rounded-lg border border-charcoal-light px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-white">Você ganhou {monthsLabel(reward.months)}</p>
                      <p className="mt-1 text-xs text-charcoal-muted">
                        {applying
                          ? 'Aplicando benefício...'
                          : `${monthsLabel(reward.months)} disponível para aplicação na sua assinatura.`}
                      </p>
                    </div>
                    {!confirming && (
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => {
                          setApplyError('')
                          setConfirmingId(reward.id)
                        }}
                        className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal disabled:opacity-50"
                      >
                        {applying ? 'Aplicando benefício...' : 'Aplicar agora'}
                      </button>
                    )}
                  </div>
                  {confirming && !applying && (
                    <div className="mt-3 rounded-lg border border-brass/30 bg-charcoal px-3 py-3">
                      <p className="text-sm text-charcoal-muted">
                        Ao aplicar esta recompensa, ela será vinculada à sua assinatura atual e não
                        poderá ser utilizada novamente.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => applyReward(reward)}
                          className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:text-white"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {applyError && <p className="mt-3 text-sm text-red-400">{applyError}</p>}
          {applySuccess && <p className="mt-3 text-sm text-brass">{applySuccess}</p>}
        </section>
      )}

      {appliedRewards.length > 0 && (
        <section className="rounded-xl border border-charcoal-light p-5">
          <h3 className="font-medium text-white">Benefício aplicado</h3>
          <ul className="mt-3 space-y-2">
            {appliedRewards.map((reward) => (
              <li key={reward.id} className="text-sm text-charcoal-muted">
                {appliedCopy(reward)}
              </li>
            ))}
          </ul>
          {data.progress.remaining > 0 && (
            <p className="mt-3 text-sm text-charcoal-muted">
              Próximo benefício: {data.progress.remaining === 1
                ? '1 indicação restante para desbloquear outra recompensa.'
                : `${data.progress.remaining} indicações restantes para desbloquear outra recompensa.`}
            </p>
          )}
        </section>
      )}

      {!availableRewards.length && applyError && (
        <p className="text-sm text-red-400">{applyError}</p>
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
          <>
          <div className="overflow-x-auto rounded-xl border border-charcoal-light hidden md:block">
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
          <ul className="space-y-3 md:hidden">
            {data.referrals.map((row) => (
              <li key={row.id} className="rounded-xl border border-charcoal-light px-4 py-3">
                <p className="font-medium text-white">{row.company}</p>
                <p className="mt-1 text-sm text-charcoal-muted">
                  {segmentLabel(String(row.segment))} · {formatDate(row.created_at)}
                </p>
                <p className="mt-2 text-sm text-charcoal-muted">
                  {referralStatusLabel(row)} · {referralRewardLabel(row)}
                </p>
              </li>
            ))}
          </ul>
          </>
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
