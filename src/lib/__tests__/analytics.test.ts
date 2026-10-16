import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeGoogleAnalytics, trackPageView } from '../analytics'

describe('GA4 runtime bootstrap', () => {
  const appendedScripts: Array<{ id: string; async: boolean; src: string }> = []

  beforeEach(() => {
    appendedScripts.length = 0

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
    expect(window.dataLayer?.[0]?.[0]).toBe('js')
    expect(window.dataLayer?.[1]).toEqual([
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
})
