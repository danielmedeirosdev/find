import type { ShopSegment } from './types'

export interface SegmentDefinition {
  id: ShopSegment
  path: string
  brandName: string
  shortName: string
  /** Nome genérico do negócio (Barbearia / Pet Shop) */
  businessLabel: string
  professionalLabel: string
  professionalPlural: string
  teamLabel: string
  customerLabel: string
  petLabel?: string
  mark: string
  ctaLabel: string
  headline: string
  description: string
  listTitle: string
  listSubtitle: string
  defaultShopName: string
  panelEyebrow: string
  panelSubtitle: string
  infoTitle: string
  logoTitle: string
  photosTitle: string
  linkTabLabel: string
  linkPageTitle: string
  hoursHint: string
  namePlaceholder: string
  deleteConfirmVerb: string
  deleteArticle: 'a' | 'o'
  blockedBody: string
  bookingNotFound: string
  publicEnvTitle: string
  bookingPath: (shopId: string) => string
  /** Classe CSS no root da experiência */
  themeClass: string
}

/**
 * Configuração central de verticais do FIND.
 * Labels compartilhados vêm daqui — não espalhar "Barbearia" hardcoded.
 */
export const SEGMENTS: Record<ShopSegment, SegmentDefinition> = {
  barbershop: {
    id: 'barbershop',
    path: '/barbearia',
    brandName: 'FIND BARBEARIA',
    shortName: 'Barbearia',
    businessLabel: 'Barbearia',
    professionalLabel: 'Barbeiro',
    professionalPlural: 'Barbeiros',
    teamLabel: 'Equipe',
    customerLabel: 'Cliente',
    mark: '💈',
    ctaLabel: 'Acessar',
    headline: 'Agenda, clientes e gestão para barbearias.',
    description: 'Serviços, equipe, horários e agendamento online no mesmo FIND.',
    listTitle: 'Encontre sua barbearia',
    listSubtitle: 'Agende online, sem fila, com estilo clássico.',
    defaultShopName: 'Minha Barbearia',
    panelEyebrow: 'FIND BARBEARIA',
    panelSubtitle: 'Painel de gestão',
    infoTitle: 'Informações da Barbearia',
    logoTitle: 'Logo da Barbearia',
    photosTitle: 'Fotos da Barbearia',
    linkTabLabel: 'Link da Barbearia',
    linkPageTitle: 'Link da Barbearia',
    hoursHint:
      'Informe os horários gerais da barbearia. Os horários individuais ficam em Equipe e horários.',
    namePlaceholder: 'Ex: Barbearia Black Crown',
    deleteConfirmVerb: 'barbearia',
    deleteArticle: 'a',
    blockedBody: 'A barbearia',
    bookingNotFound: 'Barbearia não encontrada.',
    publicEnvTitle: 'Ambiente',
    bookingPath: (shopId) => `/barbearia/${shopId}`,
    themeClass: 'segment-barbershop',
  },
  pet: {
    id: 'pet',
    path: '/pet',
    brandName: 'FIND PET',
    shortName: 'Pet',
    businessLabel: 'Pet Shop',
    professionalLabel: 'Profissional',
    professionalPlural: 'Profissionais',
    teamLabel: 'Equipe',
    customerLabel: 'Dono',
    petLabel: 'Pet',
    mark: '🐾',
    ctaLabel: 'Acessar',
    headline: 'Agenda, pets e donos para banho e tosa.',
    description:
      'Porte, duração inteligente, histórico do pet e pacotes — feitos para banho e tosa.',
    listTitle: 'Encontre o pet shop ideal para o seu pet',
    listSubtitle: 'Agende banho, tosa e cuidados de forma simples.',
    defaultShopName: 'Meu Pet Shop',
    panelEyebrow: 'FIND PET',
    panelSubtitle: 'Banho, tosa e cuidados',
    infoTitle: 'Meu pet shop',
    logoTitle: 'Logo do pet shop',
    photosTitle: 'Fotos do estabelecimento',
    linkTabLabel: 'Link público',
    linkPageTitle: 'Link para seus clientes',
    hoursHint:
      'Horário geral do pet shop. A disponibilidade de cada pessoa fica em Equipe.',
    namePlaceholder: 'Ex: Banho & Tosa da Maria',
    deleteConfirmVerb: 'pet shop',
    deleteArticle: 'o',
    blockedBody: 'O pet shop',
    bookingNotFound: 'Pet shop não encontrado.',
    publicEnvTitle: 'Espaço',
    bookingPath: (shopId) => `/pet/${shopId}`,
    themeClass: 'segment-pet',
  },
}

export const ACTIVE_SEGMENTS: ShopSegment[] = ['barbershop', 'pet']

/** Normaliza qualquer valor vindo do banco/metadata/URL para o segmento canônico. */
export function normalizeSegment(id: ShopSegment | string | null | undefined): ShopSegment {
  const raw = String(id ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (raw === 'pet' || raw === 'pets' || raw === 'petshop' || raw === 'banhoetosa') {
    return 'pet'
  }
  return 'barbershop'
}

export function getSegment(id: ShopSegment | string | null | undefined): SegmentDefinition {
  return SEGMENTS[normalizeSegment(id)]
}

export function getSegmentFromPath(pathname: string): SegmentDefinition | null {
  if (pathname === '/pet' || pathname.startsWith('/pet/')) return SEGMENTS.pet
  if (pathname === '/barbearia' || pathname.startsWith('/barbearia/')) return SEGMENTS.barbershop
  return null
}

export function parseSegmentParam(value: string | null): ShopSegment | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  if (v === 'pet' || v === 'pets' || v === 'petshop' || v === 'pet-shop') return 'pet'
  if (v === 'barbershop' || v === 'barbearia') return 'barbershop'
  return null
}

export function publicBookingPathForSegment(
  shopId: string,
  segment?: ShopSegment | string | null
): string {
  return getSegment(segment).bookingPath(shopId)
}

/** Compat: rótulo curto do negócio. */
export function businessLabel(segment?: ShopSegment | string | null): string {
  return getSegment(segment).businessLabel
}
