interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-dashed border-charcoal-light px-5 py-10 text-center ${className}`}
    >
      <p className="text-white font-medium">{title}</p>
      <p className="mt-2 text-sm text-charcoal-muted max-w-md mx-auto">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function LoadingBlock({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-charcoal-muted" role="status" aria-live="polite">
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-charcoal-light border-t-brass"
        aria-hidden
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function InlineError({ message }: { message: string }) {
  if (!message) return null
  return (
    <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300" role="alert">
      {message}
    </p>
  )
}
