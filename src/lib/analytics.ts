type Gtag = (
  command: 'event',
  eventName: string,
  params?: Record<string, string | number | boolean>
) => void

function getGtag(): Gtag | null {
  if (typeof window === 'undefined') return null
  const gtag = (window as Window & { gtag?: Gtag }).gtag
  return typeof gtag === 'function' ? gtag : null
}

export function trackSignUp(method: 'email' | 'google') {
  getGtag()?.('event', 'sign_up', { method })
}
