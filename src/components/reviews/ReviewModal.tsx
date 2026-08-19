import { useState } from 'react'
import { RATING_LABELS, submitReview } from '../../lib/reviews'
import { StarPicker } from './StarRating'
import { FieldLabel } from '../FormHints'
import { userFacingError } from '../../lib/userFacingError'

interface Props {
  bookingId: string
  shopName: string
  barberName?: string
  onClose: () => void
  onSubmitted: () => void
}

export function ReviewModal({
  bookingId,
  shopName,
  barberName,
  onClose,
  onSubmitted,
}: Props) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await submitReview(bookingId, rating, comment)
      setDone(true)
      onSubmitted()
    } catch (err) {
      setError(userFacingError(err, 'Não foi possível enviar a avaliação. Tente novamente.'))
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="w-full max-w-md animate-[reviewSlideUp_0.28s_ease-out] rounded-t-2xl border border-paper-dark bg-paper sm:rounded-2xl shadow-xl">
        {done ? (
          <div className="px-6 py-10 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brass/15 text-2xl text-brass">
              ★
            </div>
            <h2 className="font-display text-3xl text-ink">Avaliação enviada</h2>
            <p className="text-ink-muted text-sm leading-relaxed">
              Obrigado por compartilhar sua experiência.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-lg bg-brass px-6 py-2.5 font-semibold text-charcoal"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-ink-muted mb-1">{shopName}</p>
              <h2 id="review-modal-title" className="font-display text-3xl text-ink">
                Como foi seu atendimento?
              </h2>
              {barberName && (
                <p className="mt-1 text-sm text-ink-muted">com {barberName}</p>
              )}
              <p className="mt-3 text-sm text-ink-muted leading-relaxed">
                Sua opinião ajuda outras pessoas a escolherem e ajuda o profissional a melhorar.
              </p>
            </div>

            <StarPicker value={rating} onChange={setRating} disabled={submitting} />

            <div>
              <FieldLabel tone="light">Quer contar como foi sua experiência?</FieldLabel>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={submitting}
                placeholder="Conte o que você achou do atendimento…"
                className="w-full rounded-lg border border-paper-dark bg-white px-4 py-3 text-ink placeholder:text-ink-muted/50 focus:border-brass focus:outline-none resize-none"
              />
              <p className="mt-1 text-xs text-ink-muted">Opcional</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-lg border border-paper-dark py-3 text-sm text-ink-muted hover:text-ink disabled:opacity-50"
              >
                Agora não
              </button>
              <button
                type="submit"
                disabled={!rating || submitting}
                className="flex-[1.4] rounded-lg bg-brass py-3 font-semibold text-charcoal disabled:opacity-40 hover:bg-brass-light transition-colors"
              >
                {submitting
                  ? 'Enviando...'
                  : rating
                    ? `Enviar · ${RATING_LABELS[rating]}`
                    : 'Enviar avaliação'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
