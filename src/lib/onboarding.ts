export type OnboardingServiceInput = {
  name: string
  price: string
  duration: string
}

export type OnboardingStaffInput = {
  name: string
  role: string
}

export type OnboardingProfileInput = {
  slogan: string
  address: string
  phone: string
}

export function parseOnboardingProfile(input: OnboardingProfileInput) {
  const slogan = input.slogan.trim()
  const address = input.address.trim()
  const phone = input.phone.trim()
  const phoneDigits = phone.replace(/\D/g, '')

  if (slogan.length < 3 || slogan.length > 120) {
    throw new Error('Informe um slogan curto, com até 120 caracteres.')
  }
  if (address.length < 5 || address.length > 200) {
    throw new Error('Informe o endereço completo do estabelecimento.')
  }
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    throw new Error('Informe um telefone válido com DDD.')
  }

  return { slogan, address, phone }
}

export function shouldShowProfessionalOnboarding(
  role: 'owner' | 'staff' | null,
  onboardingCompleted: boolean | undefined
) {
  return role === 'owner' && onboardingCompleted === false
}

export function parseOnboardingServices(rows: OnboardingServiceInput[]) {
  const filled = rows.filter((row) => row.name.trim() || row.price.trim())

  return filled.map((row) => {
    const priceText = row.price.trim()
    const price = Number(priceText.replace(',', '.'))
    const duration = Number.parseInt(row.duration, 10)
    if (
      !row.name.trim() ||
      !priceText ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 1440
    ) {
      throw new Error('Revise o nome, o preço e a duração de cada serviço.')
    }
    return {
      name: row.name.trim(),
      price,
      duration_minutes: duration,
    }
  })
}

export function parseOnboardingStaff(rows: OnboardingStaffInput[]) {
  return rows.map((row) => {
    if (!row.name.trim()) {
      throw new Error('Informe o nome de todas as pessoas da equipe.')
    }
    return { name: row.name.trim(), role: row.role.trim() || null }
  })
}
import type { PetBusinessType, PetOnboardingMode } from './types'

export const PET_BUSINESS_TYPES: { value: PetBusinessType; label: string; description: string }[] = [
  { value: 'grooming', label: 'Banho e Tosa', description: 'Higiene, estética e cuidados recorrentes.' },
  { value: 'veterinary_clinic', label: 'Clínica Veterinária', description: 'Consultas, retornos e acompanhamento básico.' },
  { value: 'pet_shop', label: 'Pet Shop', description: 'Produtos, serviços e relacionamento com tutores.' },
  { value: 'daycare_boarding', label: 'Creche / Hospedagem', description: 'Rotina de permanência, diária e cuidados.' },
  { value: 'dog_walker', label: 'Dog Walker / Passeio', description: 'Passeios e atendimentos recorrentes.' },
  { value: 'training', label: 'Adestramento', description: 'Sessões, evolução e acompanhamento.' },
  { value: 'mixed', label: 'Negócio Pet Completo', description: 'Mais de uma frente de atendimento PET.' },
  { value: 'other', label: 'Outro', description: 'Uma operação PET com formato diferente.' },
]

export function isPetBusinessType(value: string): value is PetBusinessType {
  return PET_BUSINESS_TYPES.some((option) => option.value === value)
}

export function parsePetOnboardingChoice(
  businessType: string,
  mode: string
): { pet_business_type: PetBusinessType; pet_onboarding_mode: PetOnboardingMode } {
  if (!isPetBusinessType(businessType)) throw new Error('Selecione o ramo principal do negócio.')
  if (mode !== 'self_service' && mode !== 'guided') {
    throw new Error('Escolha como você quer começar.')
  }
  return { pet_business_type: businessType, pet_onboarding_mode: mode }
}
