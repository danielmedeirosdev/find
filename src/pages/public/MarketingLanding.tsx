import { Link } from 'react-router-dom'
import { BarberPole } from '../../components/BarberPole'
import { ListMark } from '../../components/SegmentMark'

const steps = [
  ['01', 'Escolha a solução', 'Barbearia ou pet shop. O ONEFIND se adapta ao seu negócio.'],
  ['02', 'Selecione o serviço', 'Escolha o que precisa e veja profissionais disponíveis.'],
  ['03', 'Escolha o horário', 'Veja os horários que estão livres de verdade.'],
  ['04', 'Confirme', 'Pronto. Seu horário fica reservado.'],
]

export function MarketingLanding() {
  return (
    <div className="min-h-screen overflow-hidden bg-paper text-ink">
      <header className="border-b border-paper-dark bg-paper px-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-4">
          <Link to="/" className="font-display text-3xl tracking-wider text-ink">
            ONEFIND
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden text-sm text-ink-muted transition-colors hover:text-ink sm:inline"
            >
              Voltar ao início
            </Link>
            <Link
              to="/entrar"
              className="rounded border border-ink/15 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              Entrar/Inscrever-se
            </Link>
          </div>
        </div>
        <div className="neutral-rule" aria-hidden="true" />
      </header>

      <section id="inicio" className="landing-grid paper-noise border-b border-paper-dark px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mx-auto mb-7 w-fit font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            Duas soluções · uma plataforma
          </p>
          <h1 className="font-display text-6xl leading-[.86] text-ink sm:text-8xl lg:text-9xl">
            ONEFIND
          </h1>
          <p className="mt-5 font-display text-3xl leading-none tracking-wide text-ink sm:text-4xl">
            SEU NEGÓCIO. NO SEU HORÁRIO.
          </p>
          <div className="neutral-rule mx-auto my-8 max-w-md" aria-hidden="true" />
          <p className="mx-auto max-w-xl text-base leading-7 text-ink-muted sm:text-lg">
            ONEFIND é a plataforma de agendamento online e gestão para barbearias e pet shops.
            Clientes marcam horário pelo site; profissionais gerenciam agenda, clientes e o negócio
            no painel.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/painel?modo=cadastro"
              className="rounded bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition-colors hover:bg-accent-soft"
            >
              Começar teste grátis  ›
            </Link>
            <a
              href="#solucoes"
              className="rounded border border-ink/20 bg-paper/70 px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
            >
              Escolher solução
            </a>
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
            30 dias grátis · sem cartão de crédito
          </p>
        </div>
      </section>

      <section id="solucoes" className="bg-paper px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 max-w-xl">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Uma plataforma, duas soluções
            </p>
            <h2 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
              ESCOLHA SUA SOLUÇÃO
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              to="/barbearia"
              className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm transition-colors hover:border-brass/60 sm:p-9"
            >
              <p className="font-mono text-xs text-brass">01 · FIND BARBEARIA</p>
              <BarberPole className="mt-4 max-w-[7rem]" height="h-1" />
              <h3 className="mt-6 font-display text-4xl text-ink">BARBEARIA</h3>
              <p className="mt-4 text-sm leading-6 text-ink-muted">
                Encontre sua barbearia, agende seu horário e cuide do seu visual.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                <li className="flex items-start gap-2">
                  <ListMark />
                  Busca e agendamento
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
                Ir para FIND BARBEARIA  ›
              </span>
            </Link>

            <Link
              to="/pet"
              className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm transition-colors hover:border-pet/60 sm:p-9"
            >
              <p className="font-mono text-xs text-pet">02 · FIND PET</p>
              <div className="mt-4 h-1 max-w-[7rem] rounded-full bg-pet" aria-hidden="true" />
              <h3 className="mt-6 font-display text-4xl text-ink">PET</h3>
              <p className="mt-4 text-sm leading-6 text-ink-muted">
                Encontre seu pet shop, agende banho e tosa e cuide do seu pet.
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
                Ir para FIND PET  ›
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-charcoal px-4 py-10 sm:py-16">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-white/15 bg-black shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
              <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
              <span className="h-2 w-2 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-charcoal-muted">
                FIND BARBEARIA
              </span>
            </div>
            <video
              className="block aspect-video w-full bg-black object-contain"
              controls
              playsInline
              preload="metadata"
              poster="/find-demo-poster.jpg"
            >
              <source src="/find-demo.mp4" type="video/mp4" />
              Seu navegador não suporta vídeo.
            </video>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/15 bg-black shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
              <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
              <span className="h-2 w-2 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-charcoal-muted">
                FIND PET
              </span>
            </div>
            <video
              className="block aspect-video w-full bg-black object-contain"
              controls
              playsInline
              preload="metadata"
              poster="/find-pet-demo-poster.jpg"
            >
              <source src="/find-pet-demo.mp4" type="video/mp4" />
              Seu navegador não suporta vídeo.
            </video>
          </div>
        </div>
      </section>

      <section className="bg-paper px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 max-w-xl">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Feito para os dois lados
            </p>
            <h2 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
              MENOS MENSAGENS.
              <br />
              MAIS CLIENTES.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm sm:p-9">
              <p className="font-mono text-xs text-ink-muted">01 · CLIENTES</p>
              <h3 className="mt-6 font-display text-4xl text-ink">MARQUE EM SEGUNDOS</h3>
              <ul className="mt-5 space-y-3 text-sm text-ink-muted">
                <li className="flex items-start gap-2">
                  <ListMark />
                  Encontrar uma barbearia
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  Encontrar um pet shop
                </li>
                <li className="flex items-start gap-2">
                  <ListMark />
                  Horários livres em tempo real
                </li>
              </ul>
              <div className="mt-8 flex flex-col gap-2">
                <Link to="/barbearia" className="text-sm font-semibold text-brass hover:text-ink">
                  FIND BARBEARIA  ›
                </Link>
                <Link to="/pet" className="text-sm font-semibold text-pet hover:text-ink">
                  FIND PET  ›
                </Link>
              </div>
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
                to="/painel?modo=cadastro"
                className="mt-8 inline-block text-sm font-semibold text-paper hover:text-paper/80"
              >
                Testar área profissional  ›
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="border-y border-paper-dark bg-paper-dark px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
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
                <p className="mt-3 text-sm leading-6 text-ink-muted">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink px-4 py-20 text-center sm:py-28">
        <div className="mx-auto max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/50">
            Sua agenda, do seu jeito
          </p>
          <h2 className="mt-4 font-display text-6xl leading-[.88] text-paper sm:text-7xl">
            EXPERIMENTE GRÁTIS POR 30 DIAS.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-paper/65">
            Organize seu negócio no ONEFIND, barbearia ou pet shop, e ofereça uma experiência
            melhor para cada cliente.
          </p>
          <Link
            to="/painel?modo=cadastro"
            className="mt-8 inline-block rounded bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-paper-dark"
          >
            Começar agora  ›
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
          <Link to="/painel?modo=cadastro" className="hover:text-ink">
            Cadastre sua empresa
          </Link>
        </p>
      </footer>
    </div>
  )
}
