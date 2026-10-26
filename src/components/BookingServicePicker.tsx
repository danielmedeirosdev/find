import { formatDuration, formatPrice } from '../lib/format'

interface Props {
  services: { id: string; name: string; price: number; duration: number; detail?: string }[]
  selectedIds: string[]
  onToggle: (id: string) => void
  tone?: 'light' | 'dark'
}

export function BookingServicePicker({ services, selectedIds, onToggle, tone = 'light' }: Props) {
  return <fieldset className="min-w-0 space-y-3"><legend className="sr-only">Serviços (selecione um ou mais)</legend>
    {services.map(service => <label key={service.id} className={`flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 sm:p-4 ${selectedIds.includes(service.id) ? 'border-brass bg-brass/5' : tone === 'dark' ? 'border-white/10 bg-charcoal' : 'border-paper-dark'}`}>
      <span className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={selectedIds.includes(service.id)} onChange={() => onToggle(service.id)} className="h-4 w-4 shrink-0 accent-brass"/><span className="min-w-0 break-words text-sm font-medium">{service.name}{service.detail && <span className="mt-1 block text-xs font-medium text-brass">{service.detail}</span>}</span></span>
      <span className="shrink-0 text-right font-mono text-sm"><span className="block text-brass">{formatPrice(service.price)}</span><span className={`block text-xs ${tone === 'dark' ? 'text-charcoal-muted' : 'text-ink-muted'}`}>{formatDuration(service.duration)}</span></span>
    </label>)}
    {services.length === 0 && <p className={`text-sm ${tone === 'dark' ? 'text-charcoal-muted' : 'text-ink-muted'}`}>Nenhum serviço disponível para agendar.</p>}
  </fieldset>
}
