interface BarberPoleProps {
  className?: string
  height?: string
}

export function BarberPole({ className = '', height = 'h-1' }: BarberPoleProps) {
  return (
    <div
      className={`barber-pole-stripe w-full rounded-full ${height} ${className}`}
      aria-hidden="true"
    />
  )
}
