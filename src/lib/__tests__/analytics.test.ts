import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function mockBrowser() {
  const scripts: HTMLScriptElement[] = []
  const appendChild = vi.fn((script: HTMLScriptElement) => {
    scripts.push(script)
    return script
  })

  vi.stubGlobal('window', {})
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({})),
    getElementById: vi.fn((id: string) => scripts.find((script) => script.id === id)),
    head: { appendChild },
  })

  return { scripts, appendChild }
}

describe('Meta CompleteRegistration', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends the standard event once per shop, including repeated callbacks with another method', async () => {
    mockBrowser()
    const fbq = vi.fn()
    window.fbq = fbq
    const { trackCompleteRegistration } = await import('../analytics')

    trackCompleteRegistration('email', 'shop-1')
    trackCompleteRegistration('email', 'shop-1')
    trackCompleteRegistration('google', 'shop-1')

    expect(fbq.mock.calls).toEqual([
      ['init', '1399351015059293'],
      ['track', 'CompleteRegistration', { method: 'email' }],
    ])
  })

  it('tracks a second successfully created shop separately', async () => {
    mockBrowser()
    const fbq = vi.fn()
    window.fbq = fbq
    const { trackCompleteRegistration } = await import('../analytics')

    trackCompleteRegistration('email', 'shop-1')
    trackCompleteRegistration('google', 'shop-2')
    trackCompleteRegistration('google', 'shop-2')

    expect(fbq.mock.calls.filter((call) => call[1] === 'CompleteRegistration')).toEqual([
      ['track', 'CompleteRegistration', { method: 'email' }],
      ['track', 'CompleteRegistration', { method: 'google' }],
    ])
  })

  it('ignores a result without a shop ID', async () => {
    const { scripts } = mockBrowser()
    const fbq = vi.fn()
    window.fbq = fbq
    const { trackCompleteRegistration } = await import('../analytics')

    trackCompleteRegistration('email', '')

    expect(fbq).not.toHaveBeenCalled()
    expect(scripts).toHaveLength(0)
  })

  it('reuses one script and initialization across page views and registrations', async () => {
    const { scripts, appendChild } = mockBrowser()
    const fbq = vi.fn()
    window.fbq = fbq
    const { initializeMetaPixel, trackPageView, trackCompleteRegistration } = await import('../analytics')

    trackPageView('signup-page')
    trackPageView('signup-page')
    trackCompleteRegistration('email', 'shop-1')
    trackPageView('dashboard-page')
    initializeMetaPixel()

    expect(appendChild).toHaveBeenCalledTimes(1)
    expect(scripts[0]).toMatchObject({
      id: 'onefind-meta-pixel-script',
      async: true,
      src: 'https://connect.facebook.net/en_US/fbevents.js',
    })
    expect(fbq.mock.calls.filter((call) => call[0] === 'init')).toEqual([
      ['init', '1399351015059293'],
    ])
    expect(fbq.mock.calls.filter((call) => call[1] === 'PageView')).toHaveLength(2)
    expect(fbq.mock.calls.filter((call) => call[1] === 'CompleteRegistration')).toHaveLength(1)
  })

  it('queues the completed registration while the Facebook library is still loading', async () => {
    const { scripts } = mockBrowser()
    const { trackPageView, trackCompleteRegistration } = await import('../analytics')

    trackPageView('signup-page')
    trackCompleteRegistration('google', 'shop-1')
    trackCompleteRegistration('google', 'shop-1')

    expect(window.fbq?.queue).toEqual([
      ['init', '1399351015059293'],
      ['track', 'PageView'],
      ['track', 'CompleteRegistration', { method: 'google' }],
    ])
    expect(window._fbq).toBe(window.fbq)
    expect(scripts).toHaveLength(1)

    const callMethod = vi.fn()
    window.fbq!.callMethod = callMethod
    trackCompleteRegistration('email', 'shop-2')

    expect(callMethod).toHaveBeenCalledExactlyOnceWith(
      'track', 'CompleteRegistration', { method: 'email' },
    )
  })

  it('does nothing outside the browser', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const { trackCompleteRegistration } = await import('../analytics')

    expect(() => trackCompleteRegistration('email', 'shop-1')).not.toThrow()
  })

  it('does not turn a completed registration into an error when event delivery throws', async () => {
    mockBrowser()
    window.fbq = vi.fn((command: unknown) => {
      if (command === 'track') throw new Error('Pixel unavailable')
    })
    const { trackCompleteRegistration } = await import('../analytics')

    expect(() => trackCompleteRegistration('email', 'shop-1')).not.toThrow()
    expect(window.fbq).toHaveBeenCalledWith('track', 'CompleteRegistration', { method: 'email' })
  })

  it('does not turn a completed registration into an error when Pixel initialization throws', async () => {
    const { appendChild } = mockBrowser()
    appendChild.mockImplementation(() => {
      throw new Error('Script insertion blocked')
    })
    const { trackCompleteRegistration } = await import('../analytics')

    expect(() => trackCompleteRegistration('google', 'shop-1')).not.toThrow()
  })
})
