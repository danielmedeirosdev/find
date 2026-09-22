/** Subtle shared PET brand accent. Legacy segment prop kept for existing callers. */
export function BrandAccent({ className = '', height = 'h-2' }: {
  className?: string
  height?: string
  segment?: 'barbershop' | 'pet' | 'platform' | string
}) {
  return <div className={`brand-accent w-full overflow-hidden rounded-sm ${height} ${className}`} style={{ background: 'linear-gradient(90deg, transparent, #a77c3660, transparent)', maxHeight: '2px' }} aria-hidden />
}
