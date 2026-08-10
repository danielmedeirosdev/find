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

export function defaultSizeRules(serviceId: string, baseMinutes: number, basePrice: number): Omit<ServiceSizeRule, 'id'>[] {
  return [
    {
      service_id: serviceId,
      size: 'pequeno',
      duration_minutes: Math.max(30, Math.round(baseMinutes * 0.75)),
      price: basePrice,
    },
    {
      service_id: serviceId,
      size: 'medio',
      duration_minutes: baseMinutes,
      price: basePrice,
    },
    {
      service_id: serviceId,
      size: 'grande',
      duration_minutes: Math.round(baseMinutes * 1.5),
      price: Math.round(basePrice * 1.25 * 100) / 100,
    },
  ]
}

export { getTotalDuration, getTotalPrice }
