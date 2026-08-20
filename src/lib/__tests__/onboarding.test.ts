import { describe, expect, it } from 'vitest'
import { parseOnboardingServices, parseOnboardingStaff } from '../onboarding'

describe('configuração inicial profissional', () => {
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
})
