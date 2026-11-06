import { supabase } from './supabase'

const ATTRIBUTION_KEY = 'onefind_first_touch_attribution'
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

function readStored(): MarketingAttribution | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(ATTRIBUTION_KEY)
    return stored ? (JSON.parse(stored) as MarketingAttribution) : null
  } catch {
    return null
  }
}

/** Keeps the first paid/source touch so later navigation cannot overwrite the ad origin. */
export function captureMarketingAttribution(): MarketingAttribution | null {
  if (typeof window === 'undefined') return null

  const existing = readStored()
  if (existing) return existing

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
    return null
  }

  try {
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
  } catch {
    // Attribution must never prevent navigation or signup.
  }
  return attribution
}

export function readMarketingAttribution() {
  return readStored()
}

/** Persists one immutable first-touch row for the newly created establishment. */
export async function persistMarketingAttribution(shopId: string) {
  const attribution = readStored()
  if (!attribution) return false

  const { error } = await supabase.from('shop_marketing_attribution').upsert(
    {
      shop_id: shopId,
      ...attribution,
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
