import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, formatDuration, formatPrice, formatTime } from '../../lib/format'
import { BrandAccent } from '../BrandAccent'

export type ReceiptView = {
  isPet: boolean
  shopName: string
  shopAddress?: string | null
  barberName?: string | null
  date: string
  time: string
  durationMinutes: number
  clientName: string
  clientPhone: string
  services: Array<{ id: string; name: string; price: number }>
  petName?: string | null
  petSize?: string | null
  notes?: string | null
  quotedAmount?: number | null
  discountAmount?: number
  extrasAmount?: number
  petTransportRequested?: boolean
  petTransportFee?: number
  petTransportAddress?: string | null
}

function ReceiptRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="border-b border-ink/10 py-3 last:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </div>
  )
}

export function ConfirmReceipt({
  view,
  signedIn,
}: {
  view: ReceiptView
  signedIn: boolean
}) {
  const total = view.quotedAmount ?? view.services.reduce((sum, service) => sum + Number(service.price), 0)
  const transportPricePending = Boolean(view.petTransportRequested) && Number(view.petTransportFee || 0) === 0
  const listPath = view.isPet ? '/pet' : '/barbearia'

  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <div className="bg-paper px-6 py-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brass text-charcoal">
            <svg viewBox="0 0 16 16" className="h-6 w-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8.2 6.4 12 13 4" />
            </svg>
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-brass">
            {view.isPet ? 'FIND PET' : 'FIND BARBEARIA'}
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">Horário confirmado</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Guarde este comprovante. O estabelecimento já recebeu o agendamento.
          </p>
        </div>
        <BrandAccent height="h-1.5" segment={view.isPet ? 'pet' : 'barbershop'} />

        <div className="px-6 py-2">
          <ReceiptRow label={view.isPet ? 'Pet shop' : 'Barbearia'}>
            <p className="text-base font-semibold">{view.shopName}</p>
            {view.shopAddress ? <p className="mt-0.5 text-ink-muted">{view.shopAddress}</p> : null}
          </ReceiptRow>

          {view.isPet && view.petName ? (
            <ReceiptRow label={view.petName.includes('·') ? 'Pets' : 'Pet'}>
              <p className="font-semibold">{view.petName}</p>
              {view.petSize ? <p className="text-ink-muted">Porte {view.petSize}</p> : null}
            </ReceiptRow>
          ) : null}

          {view.barberName ? (
            <ReceiptRow label="Profissional">{view.barberName}</ReceiptRow>
          ) : null}

          <ReceiptRow label="Data e horário">
            <p className="capitalize">{formatDate(view.date)}</p>
            <p className="mt-0.5 font-display text-2xl tracking-wide text-brass">
              {formatTime(view.time)}
            </p>
            <p className="text-ink-muted">{formatDuration(view.durationMinutes)}</p>
          </ReceiptRow>

          <ReceiptRow label="Serviços">
            <ul className="space-y-1">
              {view.services.map((service) => (
                <li key={service.id} className="flex justify-between gap-3">
                  <span>{service.name}</span>
                  <span className="font-medium tabular-nums">{formatPrice(Number(service.price))}</span>
                </li>
              ))}
            </ul>
          </ReceiptRow>

          {view.notes ? <ReceiptRow label="Observação">{view.notes}</ReceiptRow> : null}

          {view.petTransportRequested ? <ReceiptRow label="Táxi Dog / Táxi Pet"><p className="font-semibold">Busca em casa solicitada</p><p className="text-ink-muted">{view.petTransportAddress}</p>{transportPricePending ? <p className="mt-1 font-medium text-brass">Valor a confirmar após a análise do endereço.</p> : <p className="mt-1 text-brass">Taxa: {formatPrice(Number(view.petTransportFee))}</p>}</ReceiptRow> : null}

          {Number(view.discountAmount || 0) > 0 || Number(view.extrasAmount || 0) > 0 ? <ReceiptRow label="Ajustes do valor">{Number(view.discountAmount || 0) > 0 ? <p className="text-emerald-700">Desconto do dia: − {formatPrice(Number(view.discountAmount))}</p> : null}{Number(view.extrasAmount || 0) > 0 ? <p>Adicionais: + {formatPrice(Number(view.extrasAmount))}</p> : null}</ReceiptRow> : null}

          <ReceiptRow label="Cliente">
            <p>{view.clientName}</p>
            <p className="text-ink-muted">{view.clientPhone}</p>
          </ReceiptRow>

          <div className="flex items-baseline justify-between py-4">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
              {transportPricePending ? 'Subtotal dos serviços' : 'Total'}
            </span>
            <span className="font-display text-2xl text-brass">{formatPrice(total)}</span>
          </div>
          {transportPricePending ? <p className="-mt-2 pb-4 text-xs text-ink-muted">O valor do Táxi Pet será acrescentado quando o estabelecimento confirmar a rota.</p> : null}
        </div>
      </div>

      {!signedIn && (
        <div className="mt-5 rounded-2xl border border-ink/10 bg-white px-5 py-5 text-center">
          <p className="text-sm text-ink">Acompanhe este e os próximos horários em um só lugar.</p>
          <Link to="/cadastro" className="btn-primary mt-4 inline-flex w-full justify-center">
            Criar conta
          </Link>
        </div>
      )}

      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        {signedIn && (
          <Link to="/minhas-reservas" className="font-semibold text-brass hover:underline">
            Ver minhas reservas
          </Link>
        )}
        <Link to={listPath} className="text-ink-muted hover:text-brass">
          {view.isPet ? 'Voltar aos pet shops' : 'Voltar às barbearias'}
        </Link>
      </div>
    </div>
  )
}
