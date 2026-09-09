import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App'
import { ConfirmReceipt, type ReceiptView } from '../../components/public/ConfirmReceipt'

const route = vi.hoisted(() => ({ path: '/' }))

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...original,
    BrowserRouter: ({ children }: { children: ReactNode }) =>
      createElement(original.MemoryRouter, { initialEntries: [route.path] }, children),
  }
})

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: null, loading: false }),
}))

describe('public entry and direct booking', () => {
  it.each([
    ['/', '/painel?modo=cadastro'],
    ['/apresentacao', '/painel?modo=cadastro'],
    ['/pet', '/painel?segment=pet&amp;modo=cadastro'],
    ['/barbearia', '/painel?segment=barbershop&amp;modo=cadastro'],
  ])('presents the system and business registration at %s', (path, signup) => {
    route.path = path
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain('Começar teste grátis')
    expect(html).toContain(`href="${signup}"`)
    expect(html).toContain('href="/entrar"')
    expect(html).toContain('href="/painel"')
    expect(html).not.toContain('Encontre sua barbearia')
    expect(html).not.toContain('Encontre o pet shop ideal')
    expect(html).not.toContain('Buscar pet shop')
  })

  it.each(['/pet/shop-id', '/barbearia/shop-id', '/b/shop-slug'])(
    'keeps the direct store route at %s outside the marketing page', (path) => {
      route.path = path
      const html = renderToStaticMarkup(createElement(App))
      expect(html).not.toContain('Começar teste grátis')
      expect(html).not.toContain('Página não encontrada')
      expect(html).not.toContain('href="/pet"')
      expect(html).not.toContain('href="/barbearia"')
    },
  )

  it.each([true, false])('returns the receipt to the same store (pet=%s)', (isPet) => {
    const view: ReceiptView = {
      isPet, shopId: 'same-shop', shopName: 'Test store', date: '2026-09-10',
      time: '10:00', durationMinutes: 30, clientName: 'Test client',
      clientPhone: '', services: [],
    }
    const html = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(ConfirmReceipt, { view, signedIn: true }),
    ))
    expect(html).toContain(`href="/${isPet ? 'pet' : 'barbearia'}/same-shop"`)
    expect(html).not.toContain('href="/pet"')
    expect(html).not.toContain('href="/barbearia"')
  })
})
