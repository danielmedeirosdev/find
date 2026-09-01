import { AppIcon } from '../../../components/AppIcon'
import { ReleaseNotes } from '../../../components/ReleaseNotes'

export function UpdatesTab() {
  return (
    <section aria-labelledby="novidades-painel">
      <div className="mb-6 rounded-2xl border border-charcoal-light bg-charcoal-light/30 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brass/10 text-brass">
            <AppIcon name="megaphone" size={22} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">Novidades do ONEFIND</p>
            <h2 id="novidades-painel" className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Veja tudo o que melhorou
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-charcoal-muted">
              Atualizações do painel, do agendamento público e da gestão, organizadas por data para você não perder nenhuma novidade.
            </p>
          </div>
        </div>
      </div>
      <ReleaseNotes variant="dashboard" />
    </section>
  )
}
