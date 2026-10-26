import { describe, expect, it } from 'vitest'
import { customerLabel } from '../format'
describe('phone-only customer identity', () => {
  it('identifies a contact by its real phone until a name is provided', () => {
    expect(customerLabel({ name: '', phone: '19999991234' })).toBe('(19) 99999-1234')
    expect(customerLabel({ name: '   ', phone: '+55 19 99999-1234' })).toBe('(19) 99999-1234')
  })
  it('uses the name once the customer profile is completed', () => {
    expect(customerLabel({ name: ' Maria ', phone: '19999991234' })).toBe('Maria')
  })
})
