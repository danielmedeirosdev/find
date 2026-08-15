import { Link } from 'react-router-dom'
import { ACTIVE_SEGMENTS, SEGMENTS } from '../../lib/segments'
import { BrandAccent } from '../../components/BrandAccent'
import { SegmentMark, CtaArrow } from '../../components/SegmentMark'

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
        <h1 className="platform-fade platform-fade-delay-1 mt-3 font-display text-6xl tracking-[0.1em] text-ink sm:text-7xl md:text-8xl">
          ONEFIND
        </h1>
        <BrandAccent
          className="platform-fade platform-fade-delay-1 mx-auto mt-5 max-w-[12rem]"
          height="h-1.5"
          segment="platform"
        />
        <p className="platform-fade platform-fade-delay-2 mt-6 max-w-lg text-lg text-ink-muted sm:text-xl">
          ONEFIND é a plataforma de agendamento online e gestão para barbearias e pet shops.
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
                <span className="text-brass">
                  <SegmentMark segment={segment.mark} className="h-8 w-8" />
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

        <div className="platform-fade platform-fade-delay-4 mt-14 w-full max-w-lg rounded-xl border border-ink/10 bg-white/70 px-5 py-6">
          <p className="font-display text-xl tracking-wide text-ink">Sua empresa no ONEFIND</p>
          <p className="mt-1 text-sm text-ink-muted">
            Cadastre seu negócio ou conheça melhor a plataforma.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              to="/painel?modo=cadastro"
              className="inline-flex items-center justify-center rounded-lg bg-brass px-4 py-3 text-sm font-semibold text-charcoal transition-colors hover:bg-brass-light"
            >
              Cadastre sua empresa
            </Link>
            <Link
              to="/apresentacao"
              className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-paper transition-colors hover:bg-accent-soft"
            >
              Ver apresentação da plataforma
              <CtaArrow />
            </Link>
          </div>
          <div className="mt-5 border-t border-ink/10 pt-4">
            <p className="text-xs text-ink-muted/70">
              ONEFIND · uma plataforma, várias soluções
            </p>
            <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-ink-muted">
            <Link to="/faq" className="underline-offset-2 hover:text-brass hover:underline">
              Perguntas frequentes
            </Link>
            <Link to="/privacidade" className="underline-offset-2 hover:text-brass hover:underline">
              Política de Privacidade
            </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
