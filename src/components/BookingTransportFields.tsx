import { formatPrice } from '../lib/format'
interface Props {
  enabled: boolean
  onEnabled: (value: boolean) => void
  pending: boolean
  fee: number
  address: string
  onAddress: (value: string) => void
  notes: string
  onNotes: (value: string) => void
  tone?: 'light' | 'dark'
  feeInput?: string
  onFeeInput?: (value: string) => void
  feeError?: string
}
export function BookingTransportFields({ enabled, onEnabled, pending, fee, address, onAddress, notes, onNotes, tone = 'light', feeInput, onFeeInput, feeError }: Props) {
  const input = `mt-1.5 min-h-11 w-full rounded-xl border px-3 py-2 text-sm focus:border-brass focus:outline-none ${tone === 'dark' ? 'border-white/10 bg-charcoal text-white' : 'border-paper-dark bg-white text-ink'}`
  const muted = tone === 'dark' ? 'text-charcoal-muted' : 'text-ink-muted'
  const button = (selected: boolean) => `min-h-11 rounded-xl border px-3 py-3 text-sm font-semibold ${selected ? 'border-brass bg-brass text-charcoal' : tone === 'dark' ? 'border-white/15 text-white' : 'border-paper-dark bg-white text-ink'}`
  return <section className="space-y-3 rounded-2xl border border-brass/35 bg-brass/5 p-4" aria-label="Táxi Pet">
    <div><h3 className="font-semibold">Táxi Pet</h3>{feeError ? <p role="alert" className="mt-1 text-sm text-red-400">{feeError}</p> : <p className={`mt-1 text-sm ${muted}`}>{pending ? 'O valor será confirmado após analisar o endereço.' : `Taxa do transporte: ${formatPrice(fee)}`}</p>}</div>
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Escolha do Táxi Pet"><button type="button" aria-pressed={!enabled} onClick={() => onEnabled(false)} className={button(!enabled)}>{tone === 'dark' ? 'Sem transporte' : 'Não preciso'}</button><button type="button" aria-pressed={enabled} onClick={() => onEnabled(true)} className={button(enabled)}>Buscar em casa</button></div>
    {enabled && <div className="space-y-3">
      <label className="block text-sm font-medium">Endereço da busca<input required value={address} onChange={e => onAddress(e.target.value)} placeholder="Rua, número, bairro e cidade" minLength={5} maxLength={500} className={input}/></label>
      <label className="block text-sm font-medium">Instruções para a equipe (opcional)<textarea value={notes} onChange={e => onNotes(e.target.value)} placeholder="Complemento, referência ou cuidados na retirada" rows={2} maxLength={500} className={input}/></label>
      {onFeeInput && <div><label className="block text-sm font-medium">Valor do Táxi Pet (opcional)<input type="text" inputMode="decimal" value={feeInput || ''} onChange={e => onFeeInput(e.target.value)} placeholder={pending ? 'A confirmar' : fee.toFixed(2).replace('.', ',')} className={input}/></label><p className={`mt-1 block text-xs ${muted}`}>Em branco: taxa padrão ou valor a confirmar.</p></div>}
    </div>}
  </section>
}
