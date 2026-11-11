import { supabase } from './supabase'
import { isAnalyticsTestTraffic } from './analyticsContext'

const ATTRIBUTION_KEY = 'onefind_first_touch_attribution'
const LAST_ATTRIBUTION_KEY = 'onefind_last_touch_attribution'
const MAX_VALUE_LENGTH = 500

export type MarketingAttribution = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  fbclid: string | null
  landing_path: string
  first_seen_at: string
}

function clean(value: string | null, maxLength = MAX_VALUE_LENGTH) {
  const normalized = value?.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

function readStored(key = ATTRIBUTION_KEY): MarketingAttribution | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as MarketingAttribution) : null
  } catch {
    return null
  }
}

/** Keeps the first paid/source touch so later navigation cannot overwrite the ad origin. */
export function captureMarketingAttribution(): MarketingAttribution | null {
  if (typeof window === 'undefined') return null

  const existing = readStored()
  const params = new URLSearchParams(window.location.search)
  const attribution: MarketingAttribution = {
    utm_source: clean(params.get('utm_source')),
    utm_medium: clean(params.get('utm_medium')),
    utm_campaign: clean(params.get('utm_campaign')),
    utm_content: clean(params.get('utm_content')),
    utm_term: clean(params.get('utm_term')),
    fbclid: clean(params.get('fbclid'), 700),
    landing_path: window.location.pathname.slice(0, 500),
    first_seen_at: new Date().toISOString(),
  }

  if (!attribution.utm_source && !attribution.utm_campaign && !attribution.fbclid) {
    return existing
  }

  try {
    if (!existing) window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
    const last = readStored(LAST_ATTRIBUTION_KEY)
    if (!last || ['utm_source', 'utm_campaign', 'utm_content', 'fbclid'].some(
      key => last[key as keyof MarketingAttribution] !== attribution[key as keyof MarketingAttribution],
    )) window.localStorage.setItem(LAST_ATTRIBUTION_KEY, JSON.stringify(attribution))
  } catch {
    // Attribution must never prevent navigation or signup.
  }
  return existing ?? attribution
}

export function readMarketingAttribution() {
  return readStored()
}

export function readLatestMarketingAttribution() {
  return readStored(LAST_ATTRIBUTION_KEY) ?? readStored()
}

/** Persists one immutable first-touch row for the newly created establishment. */
export async function persistMarketingAttribution(shopId: string) {
  const attribution = readStored()
  if (!attribution) return false
  const latest = readLatestMarketingAttribution()

  const { error } = await supabase.from('shop_marketing_attribution').upsert(
    {
      shop_id: shopId,
      ...attribution,
      last_utm_source: latest?.utm_source ?? null,
      last_utm_campaign: latest?.utm_campaign ?? null,
      last_utm_content: latest?.utm_content ?? null,
      last_seen_at: latest?.first_seen_at ?? null,
      is_test: isAnalyticsTestTraffic(),
    },
    {
      onConflict: 'shop_id',
      ignoreDuplicates: true,
    },
  )

  if (error) {
    console.warn('Não foi possível salvar a atribuição de marketing.', error.message)
    return false
  }
  return true
}
