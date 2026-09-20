type Gtag = (
  command: 'event',
  eventName: string,
  params?: Record<string, string | number | boolean>
) => void

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
    fbq?: MetaPixel
    _fbq?: MetaPixel
    __onefindMetaPixelInitialized?: boolean
    __onefindMetaPixelLastPageViewKey?: string
  }
}

function getGtag(): Gtag | null {
  if (typeof window === 'undefined') return null
  const gtag = (window as Window & { gtag?: Gtag }).gtag
  return typeof gtag === 'function' ? gtag : null
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

/** Sends one PageView for each React Router navigation key. */
export function trackPageView(navigationKey: string) {
  if (typeof window === 'undefined') return
  initializeMetaPixel()
  if (window.__onefindMetaPixelLastPageViewKey === navigationKey) return

  window.fbq?.('track', 'PageView')
  window.__onefindMetaPixelLastPageViewKey = navigationKey
}

export function trackCompleteRegistration(method: 'email' | 'google') {
  if (typeof window === 'undefined') return
  initializeMetaPixel()
  window.fbq?.('track', 'CompleteRegistration', { method })
}
