import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { deleteOwnShop } from '../lib/shop'
import { getSegment } from '../lib/segments'
import type { ShopSegment } from '../lib/types'
import { FieldLabel } from './FormHints'

interface Props {
  shopName: string
  segment?: ShopSegment | string | null
  /** Compacto para overlays; completo para a aba Informações */
  variant?: 'section' | 'inline'
}

export function DeleteShopControl({ shopName, segment, variant = 'section' }: Props) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const seg = getSegment(segment)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const openConfirm = () => {
    setConfirmText('')
    setError('')
    setShowConfirm(true)
  }

  const closeConfirm = () => {
    if (deleting) return
    setShowConfirm(false)
    setConfirmText('')
    setError('')
  }

  const canConfirm = confirmText.trim().toLowerCase() === shopName.trim().toLowerCase()

  const handleDelete = async () => {
    if (!canConfirm || deleting) return
    setDeleting(true)
    setError('')
    try {
      await deleteOwnShop()
      await signOut()
      navigate('/painel', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : `Erro ao excluir o ${seg.deleteConfirmVerb}.`)
      setDeleting(false)
    }
  }

  const dialog = showConfirm ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 text-left"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-shop-title"
    >
      <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-charcoal p-6 shadow-2xl space-y-4">
        <h2 id="delete-shop-title" className="font-display text-2xl text-red-300">
          Tem certeza absoluta?
        </h2>
        <p className="text-sm text-charcoal-muted leading-relaxed">
          Você vai <span className="text-red-300 font-medium">perder tudo</span>: agendamentos,
          clientes, serviços, equipe, horários, fotos, fluxo de caixa, relatórios, link público e a
          conta profissional. Não há como recuperar depois.
        </p>
        <div>
          <FieldLabel>
            Digite o nome d{seg.deleteArticle} {seg.deleteConfirmVerb} ({shopName}) para confirmar
          </FieldLabel>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
            autoFocus
            placeholder={shopName}
            className="w-full rounded-lg border border-charcoal-light bg-charcoal-light/40 px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-red-400 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={closeConfirm}
            disabled={deleting}
            className="rounded-lg px-4 py-2 text-sm text-charcoal-muted hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canConfirm || deleting}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-red-500"
          >
            {deleting ? 'Excluindo...' : 'Sim, excluir tudo'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (variant === 'inline') {
    return (
      <>
        <button
          type="button"
          onClick={openConfirm}
          className="mt-6 text-sm text-red-400/80 underline-offset-2 hover:text-red-300 hover:underline"
        >
          Excluir {seg.deleteConfirmVerb} e apagar todos os dados
        </button>
        {dialog}
      </>
    )
  }

  return (
    <>
      <section className="rounded-lg border border-red-500/40 bg-red-950/20 p-5 space-y-3">
        <h3 className="font-display text-xl text-red-300">Zona de perigo</h3>
        <p className="text-sm text-charcoal-muted">
          Excluir {seg.deleteArticle} {seg.deleteConfirmVerb} apaga permanentemente todos os dados: agendamentos,
          serviços, equipe, fotos, financeiro, página pública e a conta de acesso. Essa ação não
          pode ser desfeita.
        </p>
        <button
          type="button"
          onClick={openConfirm}
          className="rounded-lg border border-red-500/60 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
        >
          Excluir {seg.deleteConfirmVerb}
        </button>
      </section>
      {dialog}
    </>
  )
}
