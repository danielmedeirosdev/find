import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ReleaseNotes } from '../../components/ReleaseNotes'

export function Updates() {
  return (
    <div className="page-enter pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-ink/10 bg-ink px-6 py-10 text-paper shadow-[0_24px_70px_rgba(44,36,22,0.16)] sm:px-10 sm:py-14">
        <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-brass/15 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-brass/25 bg-brass/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brass-light">
            <AppIcon name="megaphone" size={15} />
            Novidades do ONEFIND
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            O que mudou, organizado por data.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-paper-dark sm:text-lg">
            Acompanhe as melhorias que já chegaram ao agendamento, ao painel das empresas e à experiência dos clientes.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-brass-light">
              Conhecer o ONEFIND
              <AppIcon name="arrow-right" size={17} />
            </Link>
            <Link to="/painel?modo=cadastro" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-paper/20 px-4 py-2.5 text-sm font-semibold text-paper transition-[border-color,color] hover:border-brass hover:text-brass-light">
              Criar conta para empresa
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="historico-atualizacoes">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">Histórico</p>
            <h2 id="historico-atualizacoes" className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Evolução contínua do produto
            </h2>
          </div>
          <p className="hidden max-w-sm text-right text-sm leading-6 text-ink-muted sm:block">
            Esta página reúne entregas confirmadas no histórico do projeto.
          </p>
        </div>
        <ReleaseNotes />
      </section>
    </div>
  )
}
