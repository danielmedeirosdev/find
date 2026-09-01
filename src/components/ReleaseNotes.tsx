import { AppIcon } from './AppIcon'
import { formatReleaseDate, PRODUCT_RELEASES } from '../lib/releases'

interface Props {
  variant?: 'public' | 'dashboard'
}

export function ReleaseNotes({ variant = 'public' }: Props) {
  const isDashboard = variant === 'dashboard'

  return (
    <div className="space-y-6">
      {PRODUCT_RELEASES.map((release, releaseIndex) => (
        <article
          key={release.id}
          className={`release-card relative overflow-hidden rounded-2xl border ${
            isDashboard
              ? 'border-charcoal-light bg-charcoal-light/30'
              : 'border-ink/10 bg-white/55 shadow-[0_18px_55px_rgba(44,36,22,0.06)]'
          }`}
        >
          {releaseIndex === 0 ? <div className="h-1 w-full bg-brass" aria-hidden="true" /> : null}
          <div className="p-5 sm:p-7">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isDashboard ? 'bg-brass/15 text-brass' : 'bg-brass/10 text-ink'
                  }`}>
                    <AppIcon name={releaseIndex === 0 ? 'sparkles' : 'check'} size={14} />
                    {release.label}
                  </span>
                  {releaseIndex === 0 ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      isDashboard ? 'bg-white/5 text-charcoal-muted' : 'bg-ink/5 text-ink-muted'
                    }`}>
                      Mais recente
                    </span>
                  ) : null}
                </div>
                <h2 className={`text-xl font-semibold tracking-tight sm:text-2xl ${
                  isDashboard ? 'text-white' : 'text-ink'
                }`}>
                  {release.title}
                </h2>
                <p className={`mt-2 max-w-3xl text-sm leading-6 ${
                  isDashboard ? 'text-charcoal-muted' : 'text-ink-muted'
                }`}>
                  {release.summary}
                </p>
              </div>
              <time
                dateTime={release.date}
                className={`inline-flex shrink-0 items-center gap-2 text-sm ${
                  isDashboard ? 'text-charcoal-muted' : 'text-ink-muted'
                }`}
              >
                <AppIcon name="agenda" size={16} />
                {formatReleaseDate(release.date)}
              </time>
            </header>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {release.notes.map((note) => (
                <div
                  key={`${release.id}-${note.title}`}
                  className={`release-note flex gap-3 rounded-xl border p-4 ${
                    isDashboard
                      ? 'border-white/5 bg-charcoal/45'
                      : 'border-ink/[0.07] bg-paper/60'
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isDashboard ? 'bg-brass/10 text-brass' : 'bg-brass/10 text-ink'
                  }`}>
                    <AppIcon name={note.icon} size={18} />
                  </span>
                  <div>
                    <h3 className={`text-sm font-semibold ${isDashboard ? 'text-white' : 'text-ink'}`}>
                      {note.title}
                    </h3>
                    <p className={`mt-1 text-sm leading-5 ${
                      isDashboard ? 'text-charcoal-muted' : 'text-ink-muted'
                    }`}>
                      {note.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
