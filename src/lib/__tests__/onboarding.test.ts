import { describe, expect, it } from 'vitest'
import {
  parseOnboardingProfile,
  parsePetOnboardingChoice,
  parseOnboardingServices,
  parseOnboardingStaff,
  shouldShowProfessionalOnboarding,
} from '../onboarding'

describe('configuração inicial profissional', () => {
  it('normaliza os dados públicos obrigatórios', () => {
    expect(
      parseOnboardingProfile({
        slogan: ' Estilo e tradição ',
        address: ' Rua das Palmeiras, 482 - Centro ',
        phone: ' (11) 99999-9999 ',
      })
    ).toEqual({
      slogan: 'Estilo e tradição',
      address: 'Rua das Palmeiras, 482 - Centro',
      phone: '(11) 99999-9999',
    })
  })

  it('exige endereço e telefone válidos', () => {
    expect(() =>
      parseOnboardingProfile({ slogan: 'Meu negócio', address: '', phone: '123' })
    ).toThrow('Informe o endereço completo do estabelecimento.')
    expect(() =>
      parseOnboardingProfile({
        slogan: 'Meu negócio',
        address: 'Rua das Palmeiras, 482',
        phone: '123',
      })
    ).toThrow('Informe um telefone válido com DDD.')
  })

  it('normaliza preço brasileiro e ignora uma linha de serviço vazia', () => {
    expect(
      parseOnboardingServices([
        { name: ' Corte ', price: '45,50', duration: '40' },
        { name: '', price: '', duration: '30' },
      ])
    ).toEqual([{ name: 'Corte', price: 45.5, duration_minutes: 40 }])
  })

  it('recusa serviço incompleto', () => {
    expect(() =>
      parseOnboardingServices([{ name: 'Banho', price: '', duration: '60' }])
    ).toThrow('Revise o nome, o preço e a duração de cada serviço.')
  })

  it('normaliza equipe e permite cargo em branco', () => {
    expect(parseOnboardingStaff([{ name: ' Maria ', role: '' }])).toEqual([
      { name: 'Maria', role: null },
    ])
  })

  it('exige o nome de todas as pessoas', () => {
    expect(() => parseOnboardingStaff([{ name: '', role: 'Barbeiro' }])).toThrow(
      'Informe o nome de todas as pessoas da equipe.'
    )
  })

  it('mostra o assistente apenas ao dono que ainda não concluiu o primeiro acesso', () => {
    expect(shouldShowProfessionalOnboarding('owner', false)).toBe(true)
    expect(shouldShowProfessionalOnboarding('owner', true)).toBe(false)
    expect(shouldShowProfessionalOnboarding('staff', false)).toBe(false)
    expect(shouldShowProfessionalOnboarding('owner', undefined)).toBe(false)
  })

  it('valida e preserva escolhas estruturadas do onboarding PET', () => {
    expect(parsePetOnboardingChoice('veterinary_clinic', 'guided')).toEqual({
      pet_business_type: 'veterinary_clinic',
      pet_onboarding_mode: 'guided',
    })
    expect(() => parsePetOnboardingChoice('clinica', 'guided')).toThrow(
      'Selecione o ramo principal do negócio.'
    )
  })
})
