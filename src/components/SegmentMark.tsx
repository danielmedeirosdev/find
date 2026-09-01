import { AppIcon } from './AppIcon'

/** Marcas de vertical: tesoura (barbearia) e pata (pet). */
export function SegmentMark({
  segment,
  className = 'h-8 w-8',
}: {
  segment: 'barbershop' | 'pet' | string
  className?: string
}) {
  return <AppIcon name={segment === 'pet' ? 'paw' : 'scissors'} className={className} />
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
  return <AppIcon name="arrow-right" className={`ml-1 inline-block ${className} align-[-1px]`} />
}

export function SearchMark({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return <AppIcon name="search" className={className} />
}

export function BackArrow({ className = 'h-3 w-3' }: { className?: string }) {
  return <AppIcon name="arrow-left" className={`mr-1 inline-block ${className} align-[-1px]`} />
}
