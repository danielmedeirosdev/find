type AnalyticsParams = Record<string, string | number | boolean>

type Gtag = {
  (command: 'js', date: Date): void
  (command: 'config', measurementId: string, params?: AnalyticsParams): void
  (command: 'event', eventName: string, params?: AnalyticsParams): void
}

const GA_MEASUREMENT_ID = 'G-RQ3JNDR4M4'
const GA_SCRIPT_ID = 'onefind-ga4-script'
const META_PIXEL_ID = '1399351015059293'
const META_PIXEL_SCRIPT_ID = 'onefind-meta-pixel-script'

type MetaPixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue?: unknown[][]
  push?: (...args: unknown[]) => void
  loaded?: boolean
  version?: string
}

declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: Gtag
    fbq?: MetaPixel
    _fbq?: MetaPixel
    __onefindGaInitialized?: boolean
    __onefindGaLastPageViewKey?: string
    __onefindMetaPixelInitialized?: boolean
    __onefindMetaPixelLastPageViewKey?: string
  }
}

function getOrCreateGtag(): Gtag | null {
  if (typeof window === 'undefined') return null
  if (window.gtag) return window.gtag

  window.dataLayer = window.dataLayer ?? []
  const gtag = ((...args: unknown[]) => {
    window.dataLayer?.push(args)
  }) as Gtag
  window.gtag = gtag
  return gtag
}

/** Initializes GA4 from the application bundle so CSP cannot block the bootstrap. */
export function initializeGoogleAnalytics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const gtag = getOrCreateGtag()
  if (!gtag || window.__onefindGaInitialized) return

  if (!document.getElementById(GA_SCRIPT_ID)) {
    const script = document.createElement('script')
    script.id = GA_SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    document.head.appendChild(script)
  }

  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false })
  window.__onefindGaInitialized = true
}

function getGtag(): Gtag | null {
  initializeGoogleAnalytics()
  return typeof window !== 'undefined' && typeof window.gtag === 'function'
    ? window.gtag
    : null
}

export function trackSignUp(method: 'email' | 'google') {
  getGtag()?.('event', 'sign_up', { method })
}

function getOrCreateMetaPixel(): MetaPixel | null {
  if (typeof window === 'undefined') return null
  if (window.fbq) return window.fbq

  const fbq = ((...args: unknown[]) => {
    const current = fbq as MetaPixel
    if (current.callMethod) current.callMethod(...args)
    else current.queue?.push(args)
  }) as MetaPixel

  fbq.push = (...args: unknown[]) => fbq(...args)
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  window.fbq = fbq
  window._fbq = fbq
  return fbq
}

/** Initializes the Meta Pixel exactly once for the lifetime of the page. */
export function initializeMetaPixel() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const fbq = getOrCreateMetaPixel()
  if (!fbq || window.__onefindMetaPixelInitialized) return

  if (!document.getElementById(META_PIXEL_SCRIPT_ID)) {
    const script = document.createElement('script')
    script.id = META_PIXEL_SCRIPT_ID
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }

  fbq('init', META_PIXEL_ID)
  window.__onefindMetaPixelInitialized = true
}

/** Sends one GA4 and Meta PageView for each React Router navigation key. */
export function trackPageView(navigationKey: string) {
  if (typeof window === 'undefined') return

  const gtag = getGtag()
  initializeMetaPixel()

  if (window.__onefindGaLastPageViewKey !== navigationKey) {
    gtag?.('event', 'page_view', {
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search,
      page_title: document.title,
    })
    window.__onefindGaLastPageViewKey = navigationKey
  }

  if (window.__onefindMetaPixelLastPageViewKey !== navigationKey) {
    window.fbq?.('track', 'PageView')
    window.__onefindMetaPixelLastPageViewKey = navigationKey
  }
}

export function trackCompleteRegistration(method: 'email' | 'google') {
  if (typeof window === 'undefined') return
  initializeMetaPixel()
  window.fbq?.('track', 'CompleteRegistration', { method })
}

/** Conversion steps only; never send shop names, phone numbers or message contents. */
export function trackFunnel(event: 'landing_cta' | 'signup_view' | 'signup_submit' | 'setup_choice' | 'setup_whatsapp_open' | 'setup_manual_start' | 'setup_complete', params: Record<string, string> = {}) {
  try {
    getGtag()?.('event', event, params)
    if (typeof window !== 'undefined') window.fbq?.('trackCustom', event, params)
  } catch { /* Analytics must never block the product flow. */ }
}
