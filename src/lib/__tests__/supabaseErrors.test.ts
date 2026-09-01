import { describe, expect, it } from 'vitest'
import { authErrorMessage } from '../supabase'

describe('mensagens de autenticação', () => {
  it('traduz falha de rede retornada pelo cliente Supabase', () => {
    const retryableError = Object.assign(new Error('Failed to fetch'), {
      name: 'AuthRetryableFetchError',
    })

    expect(authErrorMessage(retryableError)).toBe(
      'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.'
    )
  })
})
