import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureMarketingAttribution,
  persistMarketingAttribution,
  readMarketingAttribution,
} from '../attribution'

const upsert = vi.fn(async () => ({ error: null }))

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ upsert })),
  },
}))

describe('marketing attribution', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    upsert.mockClear()
    vi.stubGlobal('window', {
      location: {
        pathname: '/',
        search:
          '?utm_source=meta&utm_medium=paid_social&utm_campaign=onefind_teste04&utm_content=beneficios_12s&fbclid=click-1',
      },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the first paid touch across later navigation', () => {
    const first = captureMarketingAttribution()
    expect(first).toMatchObject({
      utm_source: 'meta',
      utm_campaign: 'onefind_teste04',
      utm_content: 'beneficios_12s',
      fbclid: 'click-1',
    })

    window.location.search = '?utm_source=other&utm_campaign=revisit'
    expect(captureMarketingAttribution()).toEqual(first)
    expect(readMarketingAttribution()).toEqual(first)
  })

  it('persists the captured source against the created shop', async () => {
    captureMarketingAttribution()

    await expect(persistMarketingAttribution('shop-1')).resolves.toBe(true)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        shop_id: 'shop-1',
        utm_campaign: 'onefind_teste04',
        utm_content: 'beneficios_12s',
      }),
      { onConflict: 'shop_id', ignoreDuplicates: true },
    )
  })
})
