import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPhone } from '../../lib/format'
import { RATING_LABELS, submitGuestReview } from '../../lib/reviews'
import { StarPicker } from '../../components/reviews/StarRating'
import { FieldLabel } from '../../components/FormHints'
import { BarberPole } from '../../components/BarberPole'

export function GuestReview() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const [shopName, setShopName] = useState('')
  const [petName, setPetName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [eligible, setEligible] = useState(false)
  const [phone, setPhone] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!bookingId) return
    async function load() {
      const { data } = await supabase
        .from('bookings')
        .select('status, review_status, shops(name), pets(name)')
        .eq('id', bookingId)
        .maybeSingle()

      if (!data) {
        setLoading(false)
        return
      }

      setShopName((data.shops as { name?: string } | null)?.name || 'FIND')
      setPetName((data.pets as { name?: string } | null)?.name || null)
      setEligible(data.status === 'completed' && data.review_status === 'awaiting')
      setLoading(false)
    }
    load()
  }, [bookingId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingId || !rating) return
    setSubmitting(true)
    setError('')
    try {
      await submitGuestReview(bookingId, phone, rating, comment)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.')
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-center text-ink-muted">Carregando...</p>

  if (!eligible && !done) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-3xl text-ink mb-2">Avaliação indisponível</h1>
        <p className="text-ink-muted text-sm mb-6">
          Este atendimento ainda não está liberado para avaliação ou já foi avaliado.
        </p>
        <Link to="/" className="text-brass hover:underline">
          Voltar ao FIND
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md text-center rounded-lg border border-paper-dark bg-white p-8">
        <p className="font-display text-3xl text-ink mb-2">Obrigado!</p>
        <p className="text-ink-muted text-sm mb-6">Sua avaliação foi registrada.</p>
        <Link to="/" className="text-brass hover:underline">
          Voltar ao FIND
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-paper-dark bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-brass mb-1">FIND</p>
        <h1 className="font-display text-3xl text-ink">Como foi o atendimento?</h1>
        <BarberPole className="my-3 max-w-[10rem]" height="h-1.5" />
        <p className="text-sm text-ink-muted mb-6">
          {shopName}
          {petName ? ` · ${petName}` : ''}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>WhatsApp do agendamento</FieldLabel>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              required
              placeholder="Ex: (11) 99999-9999"
              className="w-full rounded-lg border border-paper-dark px-4 py-2 focus:border-brass focus:outline-none"
            />
          </div>

          <StarPicker value={rating} onChange={setRating} disabled={submitting} />

          <div>
            <FieldLabel>O que você achou? (opcional)</FieldLabel>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-paper-dark px-4 py-2 focus:border-brass focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!rating || submitting}
            className="w-full rounded-lg bg-brass py-3 font-semibold text-charcoal disabled:opacity-40"
          >
            {submitting
              ? 'Enviando...'
              : rating
                ? `Enviar · ${RATING_LABELS[rating]}`
                : 'Enviar avaliação'}
          </button>
        </form>
      </div>
    </div>
  )
}
