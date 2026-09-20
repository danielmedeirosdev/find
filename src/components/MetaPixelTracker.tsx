import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../lib/analytics'

/** Tracks one Meta PageView for each React Router navigation. */
export function MetaPixelTracker() {
  const location = useLocation()

  useEffect(() => {
    trackPageView(location.key)
  }, [location.key])

  return null
}
