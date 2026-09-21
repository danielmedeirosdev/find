import type { ShopSegment } from './types'

export interface SegmentDefinition {
  id: ShopSegment
  path: string
  brandName: string
  shortName: string
  businessLabel: string
  professionalLabel: string
  professionalPlural: string
  teamLabel: string
  customerLabel: string
  petLabel?: string
  mark: 'pet'
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
  deleteArticle: 'o'
  blockedBody: string
  bookingNotFound: string
  publicEnvTitle: string
  bookingPath: (shopId: string) => string
  themeClass: string
}

export const SEGMENTS: Record<ShopSegment, SegmentDefinition> = {
  pet: {
    id: 'pet',
    path: '/pet',
    brandName: 'onefind',
    shortName: 'Pet',
    businessLabel: 'Pet Shop',
    professionalLabel: 'Profissional',
    professionalPlural: 'Profissionais',
    teamLabel: 'Equipe',
    customerLabel: 'Tutor',
    petLabel: 'Pet',
    mark: 'pet',
    ctaLabel: 'Conhecer o onefind',
    headline: 'Clientes, pets, serviços e atendimentos organizados em um só lugar.',
    description:
      'Gestão para banho e tosa e negócios pet, com histórico do pet, equipe e rotina do estabelecimento.',
    listTitle: 'Encontre o pet shop ideal para o seu pet',
    listSubtitle: 'Escolha o pet shop e siga o fluxo definido pelo estabelecimento.',
    defaultShopName: 'Meu Pet Shop',
    panelEyebrow: 'onefind',
    panelSubtitle: 'Gestão para negócios pet',
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

export const ACTIVE_SEGMENTS: ShopSegment[] = ['pet']

export function normalizeSegment(_id: ShopSegment | string | null | undefined): ShopSegment {
  return 'pet'
}

export function getSegment(_id?: ShopSegment | string | null): SegmentDefinition {
  return SEGMENTS.pet
}

export function getSegmentFromPath(pathname: string): SegmentDefinition | null {
  if (pathname === '/pet' || pathname.startsWith('/pet/')) return SEGMENTS.pet
  return null
}

export function parseSegmentParam(value: string | null): ShopSegment | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  if (v === 'pet' || v === 'pets' || v === 'petshop' || v === 'pet-shop' || v === 'banhoetosa') {
    return 'pet'
  }
  return null
}

export function publicBookingPathForSegment(
  shopId: string,
  _segment?: ShopSegment | string | null
): string {
  return SEGMENTS.pet.bookingPath(shopId)
}

export function businessLabel(_segment?: ShopSegment | string | null): string {
  return SEGMENTS.pet.businessLabel
}
