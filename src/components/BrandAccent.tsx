import { normalizeSegment } from '../lib/segments'

/** Faixa de identidade por vertical FIND. */
export function BrandAccent({
  className = '',
  height = 'h-2',
  segment = 'platform',
}: {
  className?: string
  height?: string
  segment?: 'barbershop' | 'pet' | 'platform' | string
}) {
  const raw = String(segment ?? 'platform').trim().toLowerCase()
  // Neutro até o segmento ser conhecido — evita faixa de barbearia no PET.
  if (raw === 'platform' || raw === '' || raw === 'null' || raw === 'undefined') {
    return (
      <div
        className={`w-full overflow-hidden rounded-sm bg-gradient-to-r from-ink/80 via-brass to-ink/80 ${height} ${className}`}
        aria-hidden
      />
    )
  }

  const resolved = normalizeSegment(raw)

  if (resolved === 'pet') {
    return (
      <div
        className={`pet-accent-stripe w-full overflow-hidden rounded-sm ${height} ${className}`}
        aria-hidden
      />
    )
  }

  return (
    <div
      className={`barber-pole-stripe w-full overflow-hidden rounded-sm ${height} ${className}`}
      aria-hidden
    />
  )
}
