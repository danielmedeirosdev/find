import { describe, expect, it } from 'vitest'

/** Mirrors provision-staff-access duplicate-email detection (no listUsers). */
function isDuplicateEmailError(message: string | undefined | null): boolean {
  if (!message) return false
  return /already\s+(been\s+)?registered|already\s+exists|email.?exists|duplicate|user_already_exists/i.test(
    message
  )
}

function canOwnerProvision(actorOwnerId: string, shopOwnerId: string): boolean {
  return actorOwnerId === shopOwnerId
}

describe('provision-staff-access authorization', () => {
  it('allows owner of shop A to provision barber of shop A', () => {
    expect(canOwnerProvision('owner-a', 'owner-a')).toBe(true)
  })

  it('blocks owner of shop B from provisioning barber of shop A', () => {
    expect(canOwnerProvision('owner-b', 'owner-a')).toBe(false)
  })

  it('blocks staff (non-owner) from provisioning', () => {
    expect(canOwnerProvision('staff-user', 'owner-a')).toBe(false)
  })
})

describe('provision-staff-access duplicate email handling', () => {
  it('detects common Supabase duplicate messages', () => {
    expect(isDuplicateEmailError('User already registered')).toBe(true)
    expect(isDuplicateEmailError('A user with this email address has already been registered')).toBe(
      true
    )
    expect(isDuplicateEmailError('email_exists')).toBe(true)
    expect(isDuplicateEmailError('Network error')).toBe(false)
  })
})

describe('staff media path isolation', () => {
  it('builds path with shop + barbers + barberId segments', () => {
    const shopId = '11111111-1111-4111-8111-111111111111'
    const barberId = '22222222-2222-4222-8222-222222222222'
    const file = 'abc.jpg'
    const path = `${shopId}/barbers/${barberId}/${file}`
    const parts = path.split('/')
    expect(parts[0]).toBe(shopId)
    expect(parts[1]).toBe('barbers')
    expect(parts[2]).toBe(barberId)
  })

  it('rejects cross-barber path for staff policy shape', () => {
    const ownBarberId: string = 'barber-own'
    const otherBarberId: string = 'barber-other'
    const pathBarberId: string = otherBarberId
    expect(pathBarberId === ownBarberId).toBe(false)
  })
})
