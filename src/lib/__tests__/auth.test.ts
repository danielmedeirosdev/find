import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  attachStoredReferral: vi.fn(),
  ensureUniqueSlug: vi.fn(),
  from: vi.fn(),
  getSegment: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    auth: {},
    from: mocks.from,
  },
}))

vi.mock('../media', () => ({ ensureUniqueSlug: mocks.ensureUniqueSlug }))
vi.mock('../segments', () => ({ getSegment: mocks.getSegment }))
vi.mock('../referral', () => ({ attachStoredReferral: mocks.attachStoredReferral }))

import { ensureBarberShop } from '../auth'

describe('criação do estabelecimento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.attachStoredReferral.mockResolvedValue(undefined)
    mocks.ensureUniqueSlug.mockResolvedValue('nova-loja')
    mocks.getSegment.mockReturnValue({ defaultShopName: 'Novo estabelecimento' })
  })

  it('não cadastra serviços em uma loja existente', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'shop-1', segment: 'barbershop', name: 'Loja' },
    })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('shops')
      return { select }
    })

    await expect(
      ensureBarberShop('user-1', 'Loja', 'barbershop')
    ).resolves.toEqual({ id: 'shop-1' })

    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('cria uma loja nova sem cadastrar serviços', async () => {
    const lookup = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    }
    const single = vi.fn().mockResolvedValue({ data: { id: 'shop-2' }, error: null })
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }))
    mocks.from
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('shops')
        return lookup
      })
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('shops')
        return { insert }
      })

    await expect(
      ensureBarberShop('user-2', 'Nova loja', 'pet')
    ).resolves.toEqual({ id: 'shop-2' })

    expect(mocks.from).toHaveBeenCalledTimes(2)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ segment: 'pet' }))
  })
})
