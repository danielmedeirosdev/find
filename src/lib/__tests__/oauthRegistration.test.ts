import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signInWithIdToken: vi.fn(),
  from: vi.fn(),
  ensureBarberShop: vi.fn(),
  isLikelyNewAuthUser: vi.fn(),
  readStoredReferralCode: vi.fn(),
}))

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      updateUser: mocks.updateUser,
      signInWithIdToken: mocks.signInWithIdToken,
    },
    from: mocks.from,
  },
}))

vi.mock('../auth', () => ({
  ensureBarberShop: mocks.ensureBarberShop,
  isLikelyNewAuthUser: mocks.isLikelyNewAuthUser,
}))

vi.mock('../referral', () => ({
  readStoredReferralCode: mocks.readStoredReferralCode,
}))

import { completeGoogleCredentialLogin, finalizeOAuthLogin, rememberOAuthIntent } from '../oauth'

describe('OAuth registration success used by Meta conversions', () => {
  const user = {
    id: 'user-1',
    email: 'owner@example.test',
    user_metadata: { full_name: 'Test Owner' },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    const stored = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => stored.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => stored.set(key, value)),
      removeItem: vi.fn((key: string) => stored.delete(key)),
    })
    mocks.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
    mocks.updateUser.mockResolvedValue({ data: { user }, error: null })
    mocks.readStoredReferralCode.mockReturnValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a registration ID only after a new shop is successfully created', async () => {
    rememberOAuthIntent('barber', 'New shop', 'pet')
    mocks.ensureBarberShop.mockResolvedValue({ id: 'shop-new', created: true })

    await expect(finalizeOAuthLogin('barber')).resolves.toEqual({
      role: 'barber',
      redirectTo: '/painel/dashboard',
      createdBusiness: true,
      createdShopId: 'shop-new',
    })
    expect(mocks.ensureBarberShop).toHaveBeenCalledExactlyOnceWith('user-1', 'New shop', 'pet')
  })

  it.each([false, true])(
    'does not count an existing shop as a new registration when newUserHint is %s',
    async (newUserHint) => {
      mocks.ensureBarberShop.mockResolvedValue({ id: 'shop-existing', created: false })

      await expect(finalizeOAuthLogin('barber', { newUserHint })).resolves.toEqual({
        role: 'barber',
        redirectTo: '/painel/dashboard',
        createdBusiness: newUserHint,
        createdShopId: null,
      })
    },
  )

  it('does not count another Google credential login for a recently created user', async () => {
    mocks.signInWithIdToken.mockResolvedValue({ data: { user }, error: null })
    mocks.isLikelyNewAuthUser.mockReturnValue(true)
    mocks.ensureBarberShop.mockResolvedValue({ id: 'shop-existing', created: false })

    const result = await completeGoogleCredentialLogin(
      'barber', { credential: 'test-credential' }, 'test-nonce', 'Existing shop', 'barbershop',
    )

    expect(mocks.isLikelyNewAuthUser).toHaveBeenCalledWith(user)
    expect(result.createdBusiness).toBe(true)
    expect(result.createdShopId).toBeNull()
  })

  it('rejects without creating a shop when there is no authenticated session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })

    await expect(finalizeOAuthLogin('barber')).rejects.toThrow('Não foi possível concluir o login')
    expect(mocks.updateUser).not.toHaveBeenCalled()
    expect(mocks.ensureBarberShop).not.toHaveBeenCalled()
  })

  it('rejects a session error before creating a shop', async () => {
    const error = new Error('Session unavailable')
    mocks.getSession.mockResolvedValue({ data: { session: null }, error })

    await expect(finalizeOAuthLogin('barber')).rejects.toBe(error)
    expect(mocks.updateUser).not.toHaveBeenCalled()
    expect(mocks.ensureBarberShop).not.toHaveBeenCalled()
  })

  it('does not produce a success result when shop creation fails, even with the recent-user hint', async () => {
    const error = new Error('Shop creation failed')
    mocks.ensureBarberShop.mockRejectedValue(error)

    await expect(finalizeOAuthLogin('barber', { newUserHint: true })).rejects.toBe(error)
    expect(sessionStorage.removeItem).not.toHaveBeenCalled()
  })

  it('does not return a shop registration ID after successfully creating a client profile', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })),
      })),
      insert,
    })

    await expect(finalizeOAuthLogin('client', { newUserHint: true })).resolves.toEqual({
      role: 'client',
      redirectTo: '/minhas-reservas',
      createdBusiness: false,
      createdShopId: null,
    })
    expect(insert).toHaveBeenCalledExactlyOnceWith({ id: 'user-1', name: 'Test Owner', phone: null })
    expect(mocks.ensureBarberShop).not.toHaveBeenCalled()
  })
})
