/** Marca geométrica por vertical — sem emoji. */
export function SegmentMark({
  segment,
  className = 'h-8 w-8',
}: {
  segment: 'barbershop' | 'pet' | string
  className?: string
}) {
  if (segment === 'pet') {
    return (
      <svg
        viewBox="0 0 32 32"
        className={className}
        aria-hidden
        fill="currentColor"
      >
        <circle cx="9" cy="11" r="3.2" />
        <circle cx="23" cy="11" r="3.2" />
        <circle cx="7.5" cy="19.5" r="2.6" />
        <circle cx="24.5" cy="19.5" r="2.6" />
        <ellipse cx="16" cy="22" rx="5.2" ry="4.4" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="13" y="4" width="6" height="24" rx="1" />
      <path d="M13 10h6M13 16h6M13 22h6" />
    </svg>
  )
}

export function ListMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`mt-[0.45rem] inline-block h-1.5 w-1.5 shrink-0 rounded-sm bg-current ${className}`}
      aria-hidden
    />
  )
}
