/** Marcas de vertical: tesoura (barbearia) e pata (pet). */
export function SegmentMark({
  segment,
  className = 'h-8 w-8',
}: {
  segment: 'barbershop' | 'pet' | string
  className?: string
}) {
  if (segment === 'pet') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
        <ellipse cx="7.6" cy="11.2" rx="2.8" ry="3.4" />
        <ellipse cx="13.2" cy="7.4" rx="2.8" ry="3.4" />
        <ellipse cx="18.8" cy="7.4" rx="2.8" ry="3.4" />
        <ellipse cx="24.4" cy="11.2" rx="2.8" ry="3.4" />
        <path d="M11 16.4c2.4-2.6 7.6-2.6 10 0 2.6 2.8 3.2 7.2.4 9.6-1.6 1.4-4.2 1.6-5.2.2-.5-.7-1.1-.7-1.6 0-1 1.4-3.6 1.2-5.2-.2-2.8-2.4-2.2-6.8.4-9.6z" />
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
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8.5" cy="8.5" r="3.1" />
      <circle cx="8.5" cy="23.5" r="3.1" />
      <path d="M11 11.2 26.5 26.2" />
      <path d="M11 20.8 26.5 5.8" />
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

export function CtaArrow({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`ml-1 inline-block ${className} align-[-1px]`}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 6h8M7 3l3 3-3 3" />
    </svg>
  )
}

export function SearchMark({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="8.5" cy="8.5" r="5.2" />
      <path d="M12.6 12.6 17 17" />
    </svg>
  )
}

export function BackArrow({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`mr-1 inline-block ${className} align-[-1px]`}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 6H2M5 3 2 6l3 3" />
    </svg>
  )
}
