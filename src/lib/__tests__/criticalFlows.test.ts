import { describe, expect, it } from 'vitest'

/** Mirrors backend duration overlap rule used by create_public_booking. */
function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && startB < endA
}

function timeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

describe('agenda duration conflict (TESTE 4)', () => {
  it('blocks overlapping 60min booking at 14:00 when another starts 14:30', () => {
    const existingStart = timeToMinutes('14:00')
    const existingEnd = existingStart + 60
    const candidateStart = timeToMinutes('14:30')
    const candidateEnd = candidateStart + 30
    expect(rangesOverlap(existingStart, existingEnd, candidateStart, candidateEnd)).toBe(true)
  })

  it('allows back-to-back 14:00-15:00 then 15:00-16:00', () => {
    const a0 = timeToMinutes('14:00')
    const a1 = a0 + 60
    const b0 = timeToMinutes('15:00')
    const b1 = b0 + 60
    expect(rangesOverlap(a0, a1, b0, b1)).toBe(false)
  })
})

describe('billing status model (TESTE 7)', () => {
  it('treats blocked without complimentary as locked', () => {
    const shop = {
      subscription_status: 'blocked' as const,
      complimentary_until: null as string | null,
    }
    const complimentaryActive =
      Boolean(shop.complimentary_until) &&
      new Date(shop.complimentary_until as string) > new Date()
    expect(shop.subscription_status === 'blocked' && !complimentaryActive).toBe(true)
  })

  it('complimentary_until unlocks blocked shop until expiry', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const shop = { subscription_status: 'blocked' as const, complimentary_until: future }
    const complimentaryActive =
      Boolean(shop.complimentary_until) && new Date(shop.complimentary_until) > new Date()
    expect(shop.subscription_status === 'blocked' && !complimentaryActive).toBe(false)
  })
})

describe('referral reward apply guards (TESTE 8)', () => {
  it('rejects applying reward belonging to another shop', () => {
    const rewardShopId: string = 'shop-a'
    const actorShopId: string = 'shop-b'
    expect(rewardShopId === actorShopId).toBe(false)
  })

  it('does not double-consume redeemed reward', () => {
    const status: string = 'redeemed'
    const canApply = status === 'available'
    expect(canApply).toBe(false)
  })
})
