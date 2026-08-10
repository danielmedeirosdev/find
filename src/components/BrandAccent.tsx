/** Faixa de identidade por vertical FIND. */
export function BrandAccent({
  className = '',
  height = 'h-2',
  segment = 'barbershop',
}: {
  className?: string
  height?: string
  segment?: 'barbershop' | 'pet' | 'platform' | string
}) {
  if (segment === 'pet') {
    return (
      <div
        className={`pet-accent-stripe w-full overflow-hidden rounded-sm ${height} ${className}`}
        aria-hidden
      />
    )
  }
  if (segment === 'platform') {
    return (
      <div
        className={`w-full overflow-hidden rounded-sm bg-gradient-to-r from-ink/80 via-brass to-ink/80 ${height} ${className}`}
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
