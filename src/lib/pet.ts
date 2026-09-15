import { PET_SIZES } from './types'
import type { PetSize, Service, ServiceSizeRule } from './types'
import { getTotalDuration, getTotalPrice } from './booking'

export function petSizeLabel(size: PetSize | string): string {
  switch (size) {
    case 'pequeno':
      return 'Pequeno'
    case 'medio':
      return 'Médio'
    case 'grande':
      return 'Grande'
    default:
      return size
  }
}

/** Duração total dos serviços para um porte (usa regra ou fallback do serviço). */
export function getPetServicesDuration(
  services: Service[],
  size: PetSize,
  rules: ServiceSizeRule[]
): number {
  if (services.length === 0) return 0
  return services.reduce((sum, s) => {
    const rule = rules.find((r) => r.service_id === s.id && r.size === size)
    return sum + (rule?.duration_minutes ?? s.duration_minutes)
  }, 0)
}

export function getPetServicesPrice(
  services: Service[],
  size: PetSize,
  rules: ServiceSizeRule[]
): number {
  if (services.length === 0) return 0
  return services.reduce((sum, s) => {
    const rule = rules.find((r) => r.service_id === s.id && r.size === size)
    if (rule?.price != null) return sum + Number(rule.price)
    return sum + Number(s.price)
  }, 0)
}

export { getTotalDuration, getTotalPrice }

export interface PetDurationDraft {
  mode: 'single' | 'size'
  minutes: string
  sizes: Partial<Record<PetSize, string>>
}

export function durationPayload(draft: PetDurationDraft) {
  const valid = (value: string | undefined) => Boolean(value?.trim()) && Number.isInteger(Number(value)) && Number(value) >= 15 && Number(value) <= 720
  if (draft.mode === 'single') {
    if (!valid(draft.minutes)) throw new Error('Informe uma duração entre 15 e 720 minutos.')
    return { p_duration_minutes: Number(draft.minutes), p_size_durations: null }
  }
  if (PET_SIZES.some(({ value }) => !valid(draft.sizes[value]))) throw new Error('Preencha o tempo de cada porte, entre 15 e 720 minutos.')
  return {
    // Complete rules override this compatibility value for every supported size.
    p_duration_minutes: Number(draft.sizes[PET_SIZES[0].value]),
    p_size_durations: Object.fromEntries(PET_SIZES.map(({ value }) => [value, Number(draft.sizes[value])])),
  }
}
