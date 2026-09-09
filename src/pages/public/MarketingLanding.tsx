import { Link } from 'react-router-dom'
import { BarberPole } from '../../components/BarberPole'
import { CtaArrow, ListMark } from '../../components/SegmentMark'
import { ReferralLandingSection } from '../../components/ReferralLandingSection'
import { getSegment } from '../../lib/segments'
import type { ShopSegment } from '../../lib/types'

const steps = [
  ['01', 'Cadastre sua empresa', 'Crie sua conta e escolha o segmento do seu negócio.'],
  ['02', 'Configure sua agenda', 'Cadastre serviços, equipe e horários de atendimento.'],
  ['03', 'Divulgue seu link', 'Coloque o link da sua loja no Instagram, WhatsApp e Google.'],
  ['04', 'Receba agendamentos', 'Seu cliente escolhe o serviço e o horário. Você acompanha pelo painel.'],
]

export function MarketingLanding({ segment }: { segment?: ShopSegment }) {
  const segmentMeta = segment ? getSegment(segment) : null
  const signupPath = segment
    ? `/painel?segment=${segment}&modo=cadastro`
    : '/painel?modo=cadastro'
  const title = segmentMeta?.brandName ?? 'ONEFIND'
  const headline = segment === 'pet'
    ? 'BANHO E TOSA COM A AGENDA ORGANIZADA.'
    : segment === 'barbershop'
      ? 'SUA BARBEARIA COM A AGENDA ORGANIZADA.'
      : 'SEU NEGÓCIO. NO SEU HORÁRIO.'
  const description = segment === 'pet'
    ? 'Organize banho e tosa, serviços por porte, pets, tutores e equipe. Seus clientes agendam pelo link do seu pet shop e você acompanha tudo no painel.'
    : segment === 'barbershop'
      ? 'Organize serviços, barbeiros, agenda e financeiro. Seus clientes agendam pelo link da sua barbearia e você acompanha os atendimentos no painel.'
      : 'Agendamento online e gestão para barbearias e pet shops. Seus clientes agendam pelo link da sua loja; você gerencia agenda, equipe, clientes e financeiro no painel.'

  return (
    <div className="min-h-screen overflow-hidden bg-paper text-ink">
      <header className="border-b border-paper-dark bg-paper px-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 py-4">
          <Link to="/" className="font-display text-3xl tracking-wider text-ink">
            ONEFIND
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/entrar"
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Sou cliente
            </Link>
            <Link
              to="/painel"
              className="rounded border border-ink/15 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              Entrar no painel
            </Link>
          </div>
        </div>
        <div className="neutral-rule" aria-hidden="true" />
      </header>

      <section id="inicio" className="landing-grid paper-noise border-b border-paper-dark px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mx-auto mb-7 w-fit font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
            {segmentMeta ? `Gestão para ${segmentMeta.businessLabel.toLowerCase()}` : 'Gestão para barbearias e pet shops'}
          </p>
          <h1 className="font-display text-6xl leading-[.86] text-ink sm:text-8xl lg:text-9xl">
            {title}
          </h1>
          <p className="mt-5 font-display text-3xl leading-none tracking-wide text-ink sm:text-4xl">
            {headline}
          </p>
          <div className="neutral-rule mx-auto my-8 max-w-md" aria-hidden="true" />
          <p className="mx-auto max-w-xl text-base leading-7 text-ink-muted sm:text-lg">
            {description}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to={signupPath}
              className="rounded bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition-colors hover:bg-accent-soft"
            >
              Começar teste grátis
              <CtaArrow />
            </Link>
            <a
              href="#solucoes"
              className="rounded border border-ink/20 bg-paper/70 px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
            >
              Conhecer as soluções
            </a>
          </div>
          <p className="mt-4 font-mono text-xs uppercase tracking-wide text-ink-muted">
            30 dias grátis · depois R$ 60/mês · sem cartão no início
          </p>
        </div>
      </section>

      <section id="solucoes" className="bg-paper px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 max-w-xl">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
              Uma plataforma, duas soluções
            </p>
            <h2 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
              GESTÃO PARA O SEU NEGÓCIO
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              to={segment === 'barbershop' ? signupPath : '/barbearia'}
              className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm transition-colors hover:border-brass/60 sm:p-9"
            >
              <p className="font-mono text-xs text-brass">01 · FIND BARBEARIA</p>
              <BarberPole className="mt-4 max-w-[7rem]" height="h-1" />
              <h3 className="mt-6 font-display text-4xl text-ink">BARBEARIA</h3>
              <p className="mt-4 text-base leading-7 text-ink-muted">
                Organize sua barbearia e receba agendamentos pelo seu próprio link.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                <li className="flex items-start gap-2">
                  <ListMark />
                  Link próprio de agendamento
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  Serviços e profissionais
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  Agenda, caixa e gestão
                </li>
              </ul>
              <span className="mt-8 inline-block text-sm font-semibold text-brass">
                {segment === 'barbershop' ? 'Testar na minha barbearia' : 'Conhecer a solução para barbearias'}
                <CtaArrow />
              </span>
            </Link>

            <Link
              to={segment === 'pet' ? signupPath : '/pet'}
              className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm transition-colors hover:border-pet/60 sm:p-9"
            >
              <p className="font-mono text-xs text-pet">02 · FIND PET</p>
              <div className="mt-4 h-1 max-w-[7rem] rounded-full bg-pet" aria-hidden="true" />
              <h3 className="mt-6 font-display text-4xl text-ink">PET</h3>
              <p className="mt-4 text-base leading-7 text-ink-muted">
                Organize o banho e tosa e receba agendamentos pelo link do seu pet shop.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                <li className="flex items-start gap-2">
                  <ListMark />
                  Banho, tosa e serviços por porte
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  Cadastro de pets e tutores
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  Pacotes, faltas e gestão
                </li>
              </ul>
              <span className="mt-8 inline-block text-sm font-semibold text-pet">
                {segment === 'pet' ? 'Testar no meu pet shop' : 'Conhecer a solução para pet shops'}
                <CtaArrow />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-paper px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 max-w-xl">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
              Do agendamento à gestão
            </p>
            <h2 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
              MENOS MENSAGENS.
              <br />
              MAIS ORGANIZAÇÃO.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm sm:p-9">
              <p className="font-mono text-xs text-ink-muted">01 · SEU LINK DE AGENDAMENTO</p>
              <h3 className="mt-6 font-display text-4xl text-ink">SEU CLIENTE AGENDA DIRETO</h3>
              <ul className="mt-5 space-y-3 text-sm text-ink-muted">
                <li className="flex items-start gap-2">
                  <ListMark />
                  Link da sua loja no Instagram, WhatsApp e Google
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  Serviços e profissionais do seu estabelecimento
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  Horários livres em tempo real
                </li>
              </ul>
              <p className="mt-8 text-base leading-7 text-ink-muted">
                Seu cliente abre o link da sua loja, escolhe o serviço e confirma o horário.
                Sem precisar buscar o estabelecimento em um catálogo.
              </p>
            </article>
            <article className="rounded-lg bg-ink p-7 text-paper shadow-sm sm:p-9">
              <p className="font-mono text-xs text-paper/55">02 · ESTABELECIMENTOS</p>
              <h3 className="mt-6 font-display text-4xl">GERENCIE SEU NEGÓCIO</h3>
              <ul className="mt-5 space-y-3 text-sm text-paper/70">
                <li className="flex items-start gap-2">
                  <ListMark />
                  Equipe, serviços e agenda
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  Clientes, financeiro e relatórios
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  No PET: pets, portes, pacotes e faltas
                </li>
              </ul>
              <Link
                to={signupPath}
                className="mt-8 inline-block text-sm font-semibold text-paper hover:text-paper/80"
              >
                Testar área profissional
                <CtaArrow />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="border-y border-paper-dark bg-paper-dark px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
            Em poucos toques
          </p>
          <h2 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
            COMO FUNCIONA
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([number, title, description]) => (
              <article key={number} className="bg-paper p-6">
                <p className="font-mono text-xs text-ink-muted">{number}</p>
                <h3 className="mt-12 font-display text-2xl leading-none text-ink">
                  {title.toUpperCase()}
                </h3>
                <p className="mt-3 text-base leading-7 text-ink-muted">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <ReferralLandingSection variant={segment ?? "platform"} />
        </div>
      </section>

      <section className="bg-ink px-4 py-20 text-center sm:py-28">
        <div className="mx-auto max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-paper/50">
            Sua agenda, do seu jeito
          </p>
          <h2 className="mt-4 font-display text-6xl leading-[.88] text-paper sm:text-7xl">
            EXPERIMENTE GRÁTIS POR 30 DIAS.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-paper/65">
            Compartilhe o link do seu estabelecimento e acompanhe os agendamentos no painel.
            Depois do teste: R$ 60/mês.
          </p>
          <Link
            to={signupPath}
            className="mt-8 inline-block rounded bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-paper-dark"
          >
            Começar agora
            <CtaArrow />
          </Link>
        </div>
      </section>

      <footer className="border-t border-paper-dark bg-paper px-4 py-8 text-center text-sm text-ink-muted">
        <p className="font-display text-2xl tracking-wider text-ink">ONEFIND</p>
        <p className="mt-2">Agendamento online e gestão para barbearias e pet shops.</p>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to="/" className="hover:text-ink">
            Voltar ao início
          </Link>
          <Link to="/faq" className="hover:text-ink">
            Perguntas frequentes
          </Link>
          <Link to="/privacidade" className="hover:text-ink">
            Política de Privacidade
          </Link>
          <Link to="/barbearia" className="hover:text-ink">
            FIND BARBEARIA
          </Link>
          <Link to="/pet" className="hover:text-ink">
            FIND PET
          </Link>
          <Link to={signupPath} className="hover:text-ink">
            Cadastre sua empresa
          </Link>
        </p>
      </footer>
    </div>
  )
}
