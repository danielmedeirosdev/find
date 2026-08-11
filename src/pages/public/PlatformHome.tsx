import { Link } from 'react-router-dom'
import { ACTIVE_SEGMENTS, SEGMENTS } from '../../lib/segments'
import { BrandAccent } from '../../components/BrandAccent'

export function PlatformHome() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(201,162,39,0.12),_transparent_55%),linear-gradient(180deg,#f5f0e8_0%,#ebe4d8_100%)]"
      />

      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-2 py-10 text-center sm:py-16">
        <p className="platform-fade text-xs uppercase tracking-[0.35em] text-brass font-medium">
          Plataforma de agendamento
        </p>
        <h1 className="platform-fade platform-fade-delay-1 mt-3 font-display text-7xl tracking-[0.12em] text-ink sm:text-8xl">
          FIND
        </h1>
        <BrandAccent
          className="platform-fade platform-fade-delay-1 mx-auto mt-5 max-w-[12rem]"
          height="h-1.5"
          segment="platform"
        />
        <p className="platform-fade platform-fade-delay-2 mt-6 max-w-lg text-lg text-ink-muted sm:text-xl">
          O FIND é a plataforma de agendamento online e gestão para barbearias e pet shops.
        </p>
        <p className="platform-fade platform-fade-delay-2 mt-2 max-w-md text-sm text-ink-muted/80">
          Clientes marcam horário pelo site. Profissionais gerenciam agenda, clientes e o negócio
          em um só painel.
        </p>

        <div className="mt-12 grid w-full gap-5 sm:grid-cols-2 sm:gap-6">
          {ACTIVE_SEGMENTS.map((id, index) => {
            const segment = SEGMENTS[id]
            return (
              <Link
                key={id}
                to={segment.path}
                className={`platform-fade group flex flex-col rounded-2xl border border-ink/10 bg-white/80 p-7 text-left shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-brass/50 hover:shadow-md ${
                  index === 0 ? 'platform-fade-delay-3' : 'platform-fade-delay-4'
                }`}
              >
                <span className="text-3xl" aria-hidden>
                  {segment.mark}
                </span>
                <h2 className="mt-4 font-display text-2xl tracking-wide text-ink group-hover:text-brass transition-colors">
                  {segment.brandName}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">
                  {segment.headline}
                </p>
                <span className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brass py-3 text-sm font-semibold text-charcoal transition-colors group-hover:bg-brass-light">
                  {segment.ctaLabel}
                </span>
              </Link>
            )
          })}
        </div>

        <div className="platform-fade platform-fade-delay-4 mt-14 w-full max-w-lg border-t border-ink/10 pt-8">
          <p className="text-sm text-ink-muted mb-4">Sou profissional — quero gerenciar meu negócio</p>
          <Link
            to="/painel?modo=cadastro"
            className="inline-flex rounded-lg border border-ink/15 px-5 py-2.5 text-sm text-ink-muted transition-colors hover:border-brass hover:text-brass"
          >
            Criar profissional
          </Link>
          <p className="mt-6 text-xs text-ink-muted/70">
            <Link to="/privacidade" className="underline-offset-2 hover:text-brass hover:underline">
              Política de Privacidade
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
