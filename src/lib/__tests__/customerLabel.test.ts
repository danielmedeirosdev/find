import { describe, expect, it } from 'vitest'
import { customerLabel } from '../format'
describe('phone-only customer identity', () => {
  it('never substitutes the phone for a missing name', () => {
    expect(customerLabel({ name: '', phone: '19999991234' })).toBe('Nome não informado')
    expect(customerLabel({ name: '   ', phone: '+55 19 99999-1234' })).toBe('Nome não informado')
  })
  it('does not display legacy phone placeholders as a name', () => {
    expect(customerLabel({name:'(19) 99999-1234',phone:'19999991234'})).toBe('Nome não informado')
  })
  it('uses the name once the customer profile is completed', () => {
    expect(customerLabel({ name: ' Maria ', phone: '19999991234' })).toBe('Maria')
  })
})
