import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { captureReferralCode } from '../lib/referral'

/** Captura ?ref= na URL e persiste o código durante o cadastro. */
export function ReferralCapture() {
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const ref = params.get('ref')
    if (!ref) return
    captureReferralCode(ref)
    params.delete('ref')
    const next = params.toString()
    const url = `${location.pathname}${next ? `?${next}` : ''}${location.hash}`
    window.history.replaceState({}, '', url)
  }, [location.pathname, location.search, location.hash])

  return null
}
