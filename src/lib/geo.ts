import { foldText } from './location'

export type Coords = { lat: number; lng: number }

export type PlaceHint = {
  city: string
  locality: string
  region: string
  label: string
}

export type GeoStatus = 'asking' | 'ready' | 'denied' | 'unavailable'

export const NEARBY_KM = 40

let cachedCoords: Coords | null = null
let cachedPlace: PlaceHint | null = null
const addressCache = new Map<string, Coords | null>()

function toRad(value: number): number {
  return (value * Math.PI) / 180
}

export function haversineKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistanceKm(km: number): string {
  if (km < 1) {
    const meters = Math.max(50, Math.round(km * 20) * 50)
    return `${meters} m`
  }
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`
  return `${Math.round(km)} km`
}

export function requestUserCoords(): Promise<Coords> {
  if (cachedCoords) return Promise.resolve(cachedCoords)
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        resolve(cachedCoords)
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 }
    )
  })
}

export async function reverseGeocode(coords: Coords): Promise<PlaceHint | null> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${coords.lat}&longitude=${coords.lng}&localityLanguage=pt`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as {
    city?: string
    locality?: string
    principalSubdivision?: string
    principalSubdivisionCode?: string
  }
  const city = (data.city || data.locality || '').trim()
  const locality = (data.locality || '').trim()
  const region = String(data.principalSubdivisionCode || data.principalSubdivision || '')
    .replace(/^BR-?/i, '')
    .trim()
  const label = [city || locality, region].filter(Boolean).join(' · ')
  if (!label) return null
  return { city, locality, region, label }
}

export async function getUserPlace(): Promise<{ coords: Coords; place: PlaceHint | null }> {
  const coords = await requestUserCoords()
  if (!cachedPlace) cachedPlace = await reverseGeocode(coords)
  return { coords, place: cachedPlace }
}

export async function geocodeAddress(
  address: string,
  bias?: Coords | null
): Promise<Coords | null> {
  const key = foldText(address)
  if (!key) return null
  if (addressCache.has(key)) return addressCache.get(key) || null

  const params = new URLSearchParams({ q: address.trim(), limit: '1', lang: 'pt' })
  if (bias) {
    params.set('lat', String(bias.lat))
    params.set('lon', String(bias.lng))
  }

  try {
    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`)
    if (!res.ok) {
      addressCache.set(key, null)
      return null
    }
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: number[] } }>
    }
    const pair = data.features?.[0]?.geometry?.coordinates
    if (!pair || pair.length < 2) {
      addressCache.set(key, null)
      return null
    }
    const coords = { lng: Number(pair[0]), lat: Number(pair[1]) }
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      addressCache.set(key, null)
      return null
    }
    addressCache.set(key, coords)
    return coords
  } catch {
    addressCache.set(key, null)
    return null
  }
}

export function addressMatchesPlace(
  address: string | null | undefined,
  place: PlaceHint | null
): boolean {
  if (!address || !place) return false
  const hay = foldText(address)
  const needles = [place.city, place.locality].filter((value) => foldText(value).length >= 3)
  return needles.some((needle) => hay.includes(foldText(needle)))
}

export function geoStatusFromError(err: unknown): Exclude<GeoStatus, 'asking' | 'ready'> {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = Number((err as { code?: number }).code)
    if (code === 1) return 'denied'
  }
  if (err instanceof Error && err.message === 'unsupported') return 'unavailable'
  return 'unavailable'
}
