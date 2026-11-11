import { supabase } from './supabase'
import { captureMarketingAttribution, readMarketingAttribution, readLatestMarketingAttribution } from './attribution'
import { isAnalyticsTestTraffic } from './analyticsContext'

export type FunnelEvent = 'page_view' | 'landing_cta' | 'signup_view' | 'signup_submit' |
  'setup_choice' | 'setup_whatsapp_open' | 'setup_manual_start' | 'setup_complete' |
  'signup_error' | 'signup_start' | 'registration_complete'

const SESSION_KEY = 'onefind_funnel_session'
const PUBLIC_PATHS = new Set(['/', '/pet', '/apresentacao', '/painel', '/auth/callback'])
const STAGES = new Set(['google_load', 'google_auth', 'password_requirements', 'auth_signup',
  'missing_user', 'session_confirmation', 'shop_creation', 'unexpected'])
const SOURCES = new Set(['hero', 'landing', 'login_toggle', 'header', 'footer', 'pricing',
  'menu', 'nav', 'final', 'features', 'cta', 'mobile'])
const MAX_SESSION_EVENTS = 80
let memorySession = ''
let eventCount = 0

function identifier(value: string | null | undefined) {
  return value && /^[a-zA-Z0-9_-]{1,160}$/.test(value) ? value : null
}

function sessionId() {
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY)
    if (stored && /^[a-f0-9-]{36}$/i.test(stored)) return stored
    const created = crypto.randomUUID()
    window.sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    // Storage restrictions must not interfere with signup.
    return memorySession ||= crypto.randomUUID()
  }
}

/** Allowlisted diagnostics only: no email, password, error message or URL query. */
export async function recordFunnelEvent(
  event: FunnelEvent,
  params: Record<string, string> = {},
  shopId?: string,
) {
  try {
    if (typeof window === 'undefined' || !PUBLIC_PATHS.has(window.location.pathname)) return
    if (eventCount >= MAX_SESSION_EVENTS) return
    eventCount += 1
    captureMarketingAttribution()
    const first = readMarketingAttribution()
    const latest = readLatestMarketingAttribution()
    await supabase.from('marketing_funnel_events').insert({
      session_id: sessionId(),
      event_name: event,
      method: ['email', 'google'].includes(params.method) ? params.method : null,
      stage: STAGES.has(params.stage) ? params.stage : null,
      source: SOURCES.has(params.source || params.placement) ? (params.source || params.placement) : null,
      page_path: window.location.pathname,
      first_utm_source: identifier(first?.utm_source),
      first_utm_campaign: identifier(first?.utm_campaign),
      first_utm_content: identifier(first?.utm_content),
      last_utm_source: identifier(latest?.utm_source),
      last_utm_campaign: identifier(latest?.utm_campaign),
      last_utm_content: identifier(latest?.utm_content),
      shop_id: shopId ?? null,
      is_test: isAnalyticsTestTraffic(),
    })
  } catch { /* Diagnostics must never delay or fail a product action. */ }
}
