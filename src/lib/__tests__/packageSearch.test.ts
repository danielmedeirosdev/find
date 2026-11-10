import { describe, expect, it } from 'vitest'
import { findCustomerPackages } from '../packageSearch'
import type { CustomerPackage } from '../types'
const make = (id: string, customer: string, pet: string, status = 'active') => ({
  id, shop_customers: { name: customer }, pets: { name: pet },
  service_packages: { name: 'Banho quinzenal' }, status,
  created_at: `2026-11-${id === 'a' ? '01' : '02'}T10:00:00Z`,
}) as CustomerPackage
const packages = [make('b','Zélia','Luna'), make('a','Ágata','Jade','exhausted'), make('c','Bruna','Mel')]
const balances = [{ package_id:'a',balance:50 },{ package_id:'b',balance:0 }]

describe('package consultation', () => {
  it('sorts by the tutor in Portuguese and keeps the input unchanged', () => {
    expect(findCustomerPackages(packages,balances,'','all').map(p=>p.id)).toEqual(['a','c','b'])
    expect(packages.map(p=>p.id)).toEqual(['b','a','c'])
  })
  it('searches by tutor, pet and model without requiring accents or capitalization', () => {
    expect(findCustomerPackages(packages,balances,'AGATA jade banho','all').map(p=>p.id)).toEqual(['a'])
    expect(findCustomerPackages(packages,balances,'luna','all').map(p=>p.id)).toEqual(['b'])
  })
  it('includes exhausted packages with amounts due and excludes legacy packages of unknown status', () => {
    expect(findCustomerPackages(packages,balances,'','pending').map(p=>p.id)).toEqual(['a'])
    expect(findCustomerPackages(packages,balances,'','paid').map(p=>p.id)).toEqual(['b'])
    expect(findCustomerPackages(packages,[], '', 'pending')).toEqual([])
    expect(findCustomerPackages(packages,[{package_id:'c',balance:'NaN'}], '', 'paid')).toEqual([])
  })
  it('combines search and balance filters, and supports recent-first ordering', () => {
    expect(findCustomerPackages(packages,balances,'Luna','pending')).toEqual([])
    expect(findCustomerPackages(packages,balances,'','all','recent').at(-1)?.id).toBe('a')
  })
})
