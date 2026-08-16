import { Link } from 'react-router-dom'
import { ACTIVE_SEGMENTS, SEGMENTS } from '../../lib/segments'
import { BrandAccent } from '../../components/BrandAccent'
import { SegmentMark, CtaArrow } from '../../components/SegmentMark'

const TRUST = [
  { title: 'Sem aplicativo', text: 'Agende pelo site, no celular ou no computador.' },
  { title: 'Confirmação na hora', text: 'O horário fica reservado assim que você confirma.' },
  { title: 'Sem cadastro obrigatório', text: 'Basta nome e WhatsApp para marcar.' },
]

const STEPS = [
  { n: '01', title: 'Escolha o lugar', text: 'Barbearias ou pet shops próximos de você.' },
  { n: '02', title: 'Serviço e horário', text: 'Veja a agenda livre e escolha o que combina.' },
  { n: '03', title: 'Confirme', text: 'Informe seus dados e pronto: horário marcado.' },
]

export function PlatformHome() {
  return (
    <div className="relative overflow-hidden">
      <section className="mx-auto flex min-h-[62vh] max-w-3xl flex-col items-center px-2 pb-6 pt-8 text-center sm:pt-14">
        <p className="platform-fade text-xs font-semibold uppercase tracking-[0.35em] text-brass">
          Agendamento online
        </p>
        <h1 className="platform-fade platform-fade-delay-1 mt-3 font-display text-6xl tracking-[0.12em] text-ink sm:text-7xl md:text-8xl">
          ONEFIND
        </h1>
        <BrandAccent
          className="platform-fade platform-fade-delay-1 mx-auto mt-5 max-w-[10rem]"
          height="h-1.5"
          segment="platform"
        />
        <p className="platform-fade platform-fade-delay-2 mt-6 max-w-lg text-lg leading-relaxed text-ink sm:text-xl">
          Marque horário em barbearias e pet shops. Simples, rápido e sem ligar.
        </p>
        <p className="platform-fade platform-fade-delay-2 mt-2 max-w-md text-sm text-ink-muted">
          Escolha o estabelecimento, o serviço e o horário. A confirmação chega na hora.
        </p>

        <div className="mt-12 grid w-full gap-5 sm:grid-cols-2 sm:gap-6">
          {ACTIVE_SEGMENTS.map((id, index) => {
            const segment = SEGMENTS[id]
            return (
              <Link
                key={id}
                to={segment.path}
                className={`platform-fade group flex flex-col rounded-2xl border border-ink/10 bg-white/90 p-7 text-left shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-brass/45 hover:shadow-md ${
                  index === 0 ? 'platform-fade-delay-3' : 'platform-fade-delay-4'
                }`}
              >
                <span className="text-brass">
                  <SegmentMark segment={segment.mark} className="h-8 w-8" />
                </span>
                <h2 className="mt-4 font-display text-2xl tracking-wide text-ink transition-colors group-hover:text-brass">
                  {segment.brandName}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">
                  {segment.headline}
                </p>
                <span className="btn-primary mt-6 inline-flex w-full items-center justify-center">
                  {segment.ctaLabel}
                  <CtaArrow />
                </span>
              </Link>
            )
          })}
        </div>

        <ul className="platform-fade platform-fade-delay-4 mt-12 grid w-full gap-3 text-left sm:grid-cols-3">
          {TRUST.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-ink/10 bg-white/70 px-4 py-4"
            >
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{item.text}</p>
            </li>
          ))}
        </ul>

        <div className="platform-fade platform-fade-delay-4 mt-12 w-full rounded-2xl border border-ink/10 bg-white/80 px-5 py-7 text-left sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brass">
            Como funciona
          </p>
          <ol className="mt-5 grid gap-5 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n}>
                <p className="font-display text-2xl text-brass">{step.n}</p>
                <p className="mt-1 font-semibold text-ink">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="platform-fade platform-fade-delay-4 mt-10 w-full max-w-lg rounded-xl border border-ink/10 bg-white/70 px-5 py-6">
          <p className="font-display text-xl tracking-wide text-ink">Tem um negócio?</p>
          <p className="mt-1 text-sm text-ink-muted">
            Cadastre sua barbearia ou pet shop e receba agendamentos pelo site.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link to="/painel?modo=cadastro" className="btn-primary inline-flex items-center justify-center">
              Cadastrar empresa
            </Link>
            <Link
              to="/apresentacao"
              className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-paper transition-colors hover:bg-accent-soft"
            >
              Ver a plataforma
              <CtaArrow />
            </Link>
          </div>
          <div className="mt-5 border-t border-ink/10 pt-4">
            <p className="mt-0 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-ink-muted">
              <Link to="/faq" className="underline-offset-2 hover:text-brass hover:underline">
                Perguntas frequentes
              </Link>
              <Link to="/privacidade" className="underline-offset-2 hover:text-brass hover:underline">
                Privacidade
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
