const TEST_SESSION_KEY = 'onefind_analytics_test'

declare global {
  interface Window {
    __onefindAnalyticsTestAccount?: boolean
  }
}

/** Technical sessions never train paid campaigns or count as acquisitions. */
export function isAnalyticsTestTraffic() {
  if (typeof window === 'undefined') return false
  if (window.__onefindAnalyticsTestAccount) return true
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return true
  const requested = new URLSearchParams(window.location.search).get('onefind_test') === '1'
  try {
    if (requested) window.sessionStorage.setItem(TEST_SESSION_KEY, '1')
    return requested || window.sessionStorage.getItem(TEST_SESSION_KEY) === '1'
  } catch {
    return requested
  }
}
