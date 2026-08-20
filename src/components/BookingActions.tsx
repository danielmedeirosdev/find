import type { BookingStatus } from '../lib/types'

export type BookingActionStatus =
  | 'confirmed'
  | 'in_progress'
  | 'awaiting_payment'
  | 'no_show'
  | 'cancelled'

interface Props {
  status?: BookingStatus
  busy?: boolean
  includeAwaitingPayment?: boolean
  onStatusChange: (status: BookingActionStatus) => void
  onComplete: () => void
  className?: string
}

export function BookingActions({
  status = 'scheduled',
  busy = false,
  includeAwaitingPayment = false,
  onStatusChange,
  onComplete,
  className = '',
}: Props) {
  const canConfirm = status === 'scheduled'
  const canStart = status === 'scheduled' || status === 'confirmed'
  const canAwaitPayment =
    includeAwaitingPayment &&
    (status === 'scheduled' || status === 'confirmed' || status === 'in_progress')

  return (
    <div className={`grid grid-cols-1 gap-2 sm:flex sm:flex-wrap ${className}`.trim()}>
      {canConfirm ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStatusChange('confirmed')}
          className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white disabled:cursor-wait disabled:opacity-50"
        >
          Confirmar
        </button>
      ) : null}
      {canStart ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStatusChange('in_progress')}
          className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white disabled:cursor-wait disabled:opacity-50"
        >
          Iniciar
        </button>
      ) : null}
      {canAwaitPayment ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStatusChange('awaiting_payment')}
          className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white disabled:cursor-wait disabled:opacity-50"
        >
          Aguardando pagamento
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={onComplete}
        className="min-h-[44px] rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal disabled:cursor-wait disabled:opacity-50"
      >
        Finalizar atendimento
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onStatusChange('no_show')}
        className="min-h-[44px] rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:text-white disabled:cursor-wait disabled:opacity-50"
      >
        Não compareceu
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onStatusChange('cancelled')}
        className="min-h-[44px] rounded-lg border border-red-400/50 px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 disabled:cursor-wait disabled:opacity-50"
      >
        Cancelar
      </button>
    </div>
  )
}
