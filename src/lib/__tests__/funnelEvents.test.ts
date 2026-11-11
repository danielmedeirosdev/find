import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordFunnelEvent } from '../funnelEvents'
import { captureMarketingAttribution } from '../attribution'

const insert = vi.fn(async () => ({ error: null }))
vi.mock('../supabase', () => ({ supabase: { from: () => ({ insert }) } }))

describe('first-party funnel diagnostics', () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null })
    const storage = new Map<string, string>()
    const store = { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value) }
    vi.stubGlobal('window', { location: { hostname: 'www.onefind.com.br', pathname: '/',
      search: '?utm_source=meta&utm_campaign=onefind_teste04d&utm_content=beneficios' },
    localStorage: store, sessionStorage: store })
    captureMarketingAttribution()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('retains the campaign and exact failure stage, excluding arbitrary payload and URL data', async () => {
    window.location.pathname = '/painel'
    window.location.search = '?email=private@example.com&token=secret'
    await recordFunnelEvent('signup_error', { method: 'google', stage: 'google_auth',
      email: 'private@example.com', password: 'secret', message: 'private detail' })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ event_name: 'signup_error',
      stage: 'google_auth', method: 'google', last_utm_campaign: 'onefind_teste04d', page_path: '/painel' }))
    const payload = JSON.stringify(insert.mock.calls)
    expect(payload).not.toContain('private@example.com')
    expect(payload).not.toContain('secret')
    expect(payload).not.toContain('private detail')
  })

  it('does not collect client or booking dashboard paths', async () => {
    window.location.pathname = '/pet/private-shop'
    await recordFunnelEvent('page_view')
    expect(insert).not.toHaveBeenCalled()
  })

  it('does not reject when telemetry persistence fails', async () => {
    insert.mockRejectedValueOnce(new Error('network unavailable'))
    await expect(recordFunnelEvent('signup_start', { method: 'email' })).resolves.toBeUndefined()
  })

  it('rejects contact-like campaign values and non-allowlisted failure text', async () => {
    window.location.search = ''
    window.localStorage.setItem('onefind_last_touch_attribution', JSON.stringify({ utm_campaign: 'person@example.com' }))
    await recordFunnelEvent('signup_error', { stage: 'password=secret', method: 'private@example.com' })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({stage: null, method: null, last_utm_campaign: null}))
  })
})
