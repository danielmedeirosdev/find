import type { ShopSegment } from './types'

export type DefaultServiceSeed = {
  name: string
  price: number
  duration_minutes: number
}

/**
 * Loja nova (pet e barbearia) começa sem serviços.
 * Cadastro é feito só pelo dono no painel.
 */
export const DEFAULT_SERVICES_BY_SEGMENT: Record<ShopSegment, DefaultServiceSeed[]> = {
  barbershop: [],
  pet: [],
}

export function defaultServicesForSegment(segment: ShopSegment): DefaultServiceSeed[] {
  return DEFAULT_SERVICES_BY_SEGMENT[segment] ?? []
}
