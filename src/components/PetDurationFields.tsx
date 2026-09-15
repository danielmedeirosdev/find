import { useId } from 'react'
import { PET_SIZES } from '../lib/types'
import type { PetDurationDraft } from '../lib/pet'

export function PetDurationFields({ value, onChange, disabled = false }: { value: PetDurationDraft; onChange: (value: PetDurationDraft) => void; disabled?: boolean }) {
  const groupName = useId()
  const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 text-sm text-white'
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="text-sm font-semibold text-white">Duração do serviço</legend>
    <div className="flex flex-wrap gap-4 text-sm text-white">
      <label className="flex min-h-11 items-center gap-2"><input type="radio" name={groupName} checked={value.mode === 'single'} onChange={() => onChange({ ...value, mode: 'single' })} />Duração única</label>
      <label className="flex min-h-11 items-center gap-2"><input type="radio" name={groupName} checked={value.mode === 'size'} onChange={() => onChange({ ...value, mode: 'size' })} />Duração por porte</label>
    </div>
    {value.mode === 'single' ? <label className="block text-xs text-charcoal-muted">Minutos para qualquer porte
      <input type="number" min="15" max="720" step="1" required value={value.minutes} onChange={(e) => onChange({ ...value, minutes: e.target.value })} className={inputClass} />
    </label> : <div className="grid gap-3 sm:grid-cols-3">{PET_SIZES.map(({ value: size, label }) => <label key={size} className="text-xs text-charcoal-muted">{label} (min)
      <input type="number" min="15" max="720" step="1" required value={value.sizes[size] ?? ''} onChange={(e) => onChange({ ...value, sizes: { ...value.sizes, [size]: e.target.value } })} className={inputClass} />
    </label>)}</div>}
    <p className="text-xs text-charcoal-muted">Informe os tempos usados no seu estabelecimento.</p>
  </fieldset>
}
