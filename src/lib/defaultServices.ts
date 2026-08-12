import type { ShopSegment } from './types'

export type DefaultServiceSeed = {
  name: string
  price: number
  duration_minutes: number
}

/** Serviços padrão por vertical — nunca reutilizar de outra. */
export const DEFAULT_SERVICES_BY_SEGMENT: Record<ShopSegment, DefaultServiceSeed[]> = {
  barbershop: [
    { name: 'Corte', price: 45, duration_minutes: 40 },
    { name: 'Barba', price: 30, duration_minutes: 25 },
    { name: 'Corte + Barba', price: 65, duration_minutes: 55 },
  ],
  pet: [
    { name: 'Banho', price: 50, duration_minutes: 60 },
    { name: 'Tosa', price: 60, duration_minutes: 90 },
    { name: 'Banho + Tosa', price: 100, duration_minutes: 120 },
    { name: 'Hidratação', price: 40, duration_minutes: 40 },
  ],
}

const BARBERSHOP_DEFAULT_NAMES = new Set(
  DEFAULT_SERVICES_BY_SEGMENT.barbershop.map((s) => s.name)
)

/** True se a loja só tem o seed clássico de barbearia (ex.: PET criada com seed errado). */
export function isOnlyBarbershopDefaultServices(
  services: { name: string }[] | null | undefined
): boolean {
  if (!services || services.length === 0) return false
  return services.every((s) => BARBERSHOP_DEFAULT_NAMES.has(s.name))
}

export function defaultServicesForSegment(segment: ShopSegment): DefaultServiceSeed[] {
  return DEFAULT_SERVICES_BY_SEGMENT[segment] ?? []
}
