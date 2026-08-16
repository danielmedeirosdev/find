export function PageLoader({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="mx-auto h-3 w-28 animate-pulse rounded-full bg-paper-dark" />
      <div className="mx-auto h-8 w-64 max-w-full animate-pulse rounded-lg bg-paper-dark" />
      <div className="mx-auto h-4 w-80 max-w-full animate-pulse rounded-full bg-paper-dark/80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-36 animate-pulse rounded-2xl bg-white/70 ring-1 ring-ink/5" />
        <div className="h-36 animate-pulse rounded-2xl bg-white/70 ring-1 ring-ink/5" />
      </div>
    </div>
  )
}

export function ShopCardSkeleton() {
  return (
    <div className="h-48 animate-pulse rounded-2xl bg-white/80 ring-1 ring-ink/5" />
  )
}
