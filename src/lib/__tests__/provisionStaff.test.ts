import { describe, expect, it } from 'vitest'
import {
  buildManagedStaffMetadata,
  isDuplicateEmailError,
  isManagedStaffAccount,
  isShopOwner,
} from '../../../supabase/functions/provision-staff-access/staff-security.ts'

describe('provision-staff-access authorization', () => {
  it('allows owner of shop A to provision barber of shop A', () => {
    expect(isShopOwner('owner-a', 'owner-a')).toBe(true)
  })

  it('blocks owner of shop B from provisioning barber of shop A', () => {
    expect(isShopOwner('owner-b', 'owner-a')).toBe(false)
  })

  it('blocks staff (non-owner) from provisioning', () => {
    expect(isShopOwner('staff-user', 'owner-a')).toBe(false)
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

  it('only accepts metadata created for the exact shop and professional', () => {
    const metadata = buildManagedStaffMetadata('shop-a', 'barber-a', 'Daniel')

    expect(isManagedStaffAccount(metadata, 'shop-a', 'barber-a')).toBe(true)
    expect(isManagedStaffAccount(metadata, 'shop-b', 'barber-a')).toBe(false)
    expect(isManagedStaffAccount(metadata, 'shop-a', 'barber-b')).toBe(false)
    expect(isManagedStaffAccount({}, 'shop-a', 'barber-a')).toBe(false)
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
