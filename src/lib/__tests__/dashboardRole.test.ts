import { describe, expect, it } from 'vitest'
import {
  isOwnerOnlyTab,
  pickDashboardMembership,
  resolveStaffTab,
} from '../dashboardRole'
import { userFacingError } from '../userFacingError'
import type { Barber, Shop } from '../types'

const shopA: Shop = {
  id: '11111111-1111-4111-8111-111111111111',
  owner_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Barbearia A',
  slogan: null,
  address: null,
  phone: null,
  hours_text: null,
  cpf_cnpj: null,
  asaas_customer_id: null,
  subscription_status: 'trial',
  trial_ends_at: null,
  created_at: '2026-01-01T00:00:00Z',
  segment: 'barbershop',
}

const shopB: Shop = {
  ...shopA,
  id: '22222222-2222-4222-8222-222222222222',
  owner_user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Pet B',
  segment: 'pet',
}

describe('dashboard roles', () => {
  it('prefers owner membership over staff', () => {
    const barber: Barber & { shops: Shop } = {
      id: '33333333-3333-4333-8333-333333333333',
      shop_id: shopA.id,
      name: 'Lucas',
      user_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      shops: shopA,
    }
    const m = pickDashboardMembership({ ownedShop: shopA, staffBarber: barber })
    expect(m?.role).toBe('owner')
    expect(m?.shop.id).toBe(shopA.id)
  })

  it('resolves staff membership with linked shop', () => {
    const barber: Barber & { shops: Shop } = {
      id: '33333333-3333-4333-8333-333333333333',
      shop_id: shopB.id,
      name: 'Ana',
      user_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      shops: shopB,
    }
    const m = pickDashboardMembership({ ownedShop: null, staffBarber: barber })
    expect(m?.role).toBe('staff')
    expect(m?.barber?.id).toBe(barber.id)
    expect(m?.shop.id).toBe(shopB.id)
  })

  it('blocks owner-only tabs for staff navigation allowlist', () => {
    expect(isOwnerOnlyTab('cashflow')).toBe(true)
    expect(isOwnerOnlyTab('subscription')).toBe(true)
    expect(isOwnerOnlyTab('referral')).toBe(true)
    expect(isOwnerOnlyTab('team')).toBe(true)
    expect(isOwnerOnlyTab('agenda')).toBe(false)
    expect(resolveStaffTab('cashflow')).toBe('agenda')
    expect(resolveStaffTab('profile')).toBe('profile')
  })
})

describe('userFacingError', () => {
  it('hides technical postgres / network codes', () => {
    expect(userFacingError('PGRST116', 'Falha ao salvar')).toBe(
      'Você não tem permissão para esta ação.'
    )
    expect(userFacingError(new Error('Failed to fetch'), 'Falha')).toMatch(/conectar/i)
    expect(userFacingError(new Error('500 Internal Server Error'), 'Não foi possível salvar')).toBe(
      'Não foi possível salvar'
    )
  })

  it('keeps Portuguese RPC messages', () => {
    expect(
      userFacingError(
        new Error('Sem permissão para finalizar este atendimento'),
        'Falha'
      )
    ).toMatch(/permissão/i)
  })
})

describe('multi-tenant shop identity', () => {
  it('keeps shop A and B ids distinct for isolation assertions', () => {
    expect(shopA.id).not.toBe(shopB.id)
    expect(shopA.owner_user_id).not.toBe(shopB.owner_user_id)
  })
})
