import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeGoogleAnalytics, trackPageView, trackBusinessRegistration, trackFunnel } from '../analytics'

const insert = vi.fn(async () => ({ error: null }))
vi.mock('../supabase', () => ({ supabase: { from: () => ({ insert }) } }))

describe('GA4 runtime bootstrap', () => {
  const appendedScripts: Array<{ id: string; async: boolean; src: string }> = []

  beforeEach(() => {
    appendedScripts.length = 0
    insert.mockClear()

    vi.stubGlobal('window', {
      location: {
        href: 'https://www.onefind.com.br/',
        pathname: '/',
        search: '',
      },
    })
    vi.stubGlobal('document', {
      title: 'onefind',
      getElementById: vi.fn((id: string) =>
        appendedScripts.find((script) => script.id === id) ?? null,
      ),
      createElement: vi.fn(() => ({ id: '', async: false, src: '' })),
      head: {
        appendChild: vi.fn((script: { id: string; async: boolean; src: string }) => {
          appendedScripts.push(script)
        }),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and configures GA4 exactly once', () => {
    initializeGoogleAnalytics()
    initializeGoogleAnalytics()

    expect(appendedScripts).toEqual([
      {
        id: 'onefind-ga4-script',
        async: true,
        src: 'https://www.googletagmanager.com/gtag/js?id=G-RQ3JNDR4M4',
      },
    ])
    expect(window.dataLayer).toHaveLength(2)
    // Google dispatches Arguments as gtag commands and arrays as data-model methods.
    for (const command of window.dataLayer ?? []) {
      expect(Object.prototype.toString.call(command)).toBe('[object Arguments]')
      expect(Array.isArray(command)).toBe(false)
    }
    expect(window.dataLayer?.[0]?.[0]).toBe('js')
    expect(Array.from(window.dataLayer?.[1] ?? [])).toEqual([
      'config',
      'G-RQ3JNDR4M4',
      { send_page_view: false },
    ])
  })

  it('sends one page_view per router navigation key, including the first', () => {
    trackPageView('default')
    trackPageView('default')

    window.location.href = 'https://www.onefind.com.br/painel?modo=cadastro'
    window.location.pathname = '/painel'
    window.location.search = '?modo=cadastro'
    trackPageView('next')

    const pageViews = window.dataLayer?.filter(
      (entry) => entry[0] === 'event' && entry[1] === 'page_view',
    )
    expect(pageViews).toHaveLength(2)
    expect(pageViews?.[0]?.[2]).toMatchObject({ page_path: '/' })
    expect(pageViews?.[1]?.[2]).toMatchObject({
      page_path: '/painel?modo=cadastro',
    })
  })

  it('records technical diagnostics without sending acquisition events to GA4 or Meta', async () => {
    const storage = new Map<string, string>()
    window.sessionStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      clear: () => storage.clear(),
      removeItem: (key: string) => { storage.delete(key) },
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() { return storage.size },
    } as Storage
    window.localStorage = window.sessionStorage
    window.location.search = '?onefind_test=1'
    trackPageView('technical')
    window.location.search = ''
    trackFunnel('signup_error', { method: 'google', stage: 'google_auth' })
    trackBusinessRegistration('1bf81d61-803e-4a5c-9b33-08e458532ed4', 'email')
    await Promise.resolve()
    expect(appendedScripts).toHaveLength(0)
    expect(window.dataLayer).toBeUndefined()
    expect(window.fbq).toBeUndefined()
    expect(insert.mock.calls.length).toBe(3)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      event_name: 'registration_complete', is_test: true,
    }))
  })
})
