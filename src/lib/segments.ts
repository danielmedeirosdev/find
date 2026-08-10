import type { ShopSegment } from './types'

export interface SegmentDefinition {
  id: ShopSegment
  /** Path público da vertical, ex: /barbearia */
  path: string
  brandName: string
  shortName: string
  headline: string
  description: string
  /** Ícone visual curto (pode ser emoji ou símbolo) */
  mark: string
  ctaLabel: string
  listTitle: string
  listSubtitle: string
  professionalLabel: string
  defaultShopName: string
  bookingPath: (shopId: string) => string
}

/**
 * Registry de verticais do FIND.
 * Para adicionar FIND BEAUTY etc.: registre aqui + regras/telas específicas.
 * Não copie o projeto.
 */
export const SEGMENTS: Record<ShopSegment, SegmentDefinition> = {
  barbershop: {
    id: 'barbershop',
    path: '/barbearia',
    brandName: 'FIND BARBEARIA',
    shortName: 'Barbearia',
    headline: 'Agenda, clientes e gestão para barbearias.',
    description: 'Serviços, equipe, horários e agendamento online no mesmo FIND.',
    mark: '💈',
    ctaLabel: 'Acessar',
    listTitle: 'Encontre sua barbearia',
    listSubtitle: 'Agende online, sem fila, com estilo clássico.',
    professionalLabel: 'barbearia',
    defaultShopName: 'Minha Barbearia',
    bookingPath: (shopId) => `/barbearia/${shopId}`,
  },
  pet: {
    id: 'pet',
    path: '/pet',
    brandName: 'FIND PET',
    shortName: 'Pet',
    headline: 'Agenda, clientes e pets para banho e tosa.',
    description: 'Porte, duração inteligente e histórico do pet no mesmo FIND.',
    mark: '🐾',
    ctaLabel: 'Acessar',
    listTitle: 'Encontre seu pet shop',
    listSubtitle: 'Agende banho e tosa pelo porte do pet, sem complicação.',
    professionalLabel: 'pet shop',
    defaultShopName: 'Meu Pet Shop',
    bookingPath: (shopId) => `/pet/${shopId}`,
  },
}

/** Verticais ativas na plataforma (ordem da landing). */
export const ACTIVE_SEGMENTS: ShopSegment[] = ['barbershop', 'pet']

export function getSegment(id: ShopSegment | string | null | undefined): SegmentDefinition {
  if (id === 'pet') return SEGMENTS.pet
  return SEGMENTS.barbershop
}

export function getSegmentFromPath(pathname: string): SegmentDefinition | null {
  if (pathname === '/pet' || pathname.startsWith('/pet/')) return SEGMENTS.pet
  if (pathname === '/barbearia' || pathname.startsWith('/barbearia/')) return SEGMENTS.barbershop
  return null
}

export function parseSegmentParam(value: string | null): ShopSegment | null {
  if (value === 'pet' || value === 'barbershop') return value
  return null
}

export function publicBookingPathForSegment(
  shopId: string,
  segment?: ShopSegment | string | null
): string {
  return getSegment(segment).bookingPath(shopId)
}
