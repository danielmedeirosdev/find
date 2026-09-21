import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CtaArrow, ListMark } from '../../components/SegmentMark'
import { ReferralLandingSection } from '../../components/ReferralLandingSection'

const steps = [
  ['01', 'Cadastre seu pet shop', 'Crie sua conta e informe os dados básicos do estabelecimento.'],
  ['02', 'Organize sua operação', 'Cadastre clientes, pets, serviços, equipe e a forma como você atende.'],
  ['03', 'Divulgue seu link', 'Coloque o link do seu estabelecimento no Instagram, WhatsApp e Google.'],
  ['04', 'Gerencie os atendimentos', 'Acompanhe a rotina, histórico dos pets e informações do negócio em um só lugar.'],
]

export function MarketingLanding() {
  const location = useLocation()
  const signupPath = '/painel?segment=pet&modo=cadastro'

  useEffect(() => {
    const isPetPage = location.pathname === '/pet'
    const canonicalUrl = isPetPage ? 'https://www.onefind.com.br/pet' : 'https://www.onefind.com.br/'
    const title = isPetPage
      ? 'onefind para Pet Shops e Banho e Tosa | Gestão PET'
      : 'onefind · Gestão para pet shops e banho e tosa'
    const description = isPetPage
      ? 'Gestão para pet shops e banho e tosa. Organize clientes, pets, serviços, atendimentos e histórico em um só lugar. Teste grátis por 30 dias.'
      : 'onefind é a plataforma de gestão para pet shops, banho e tosa e outros negócios pet. Organize clientes, pets, serviços, atendimentos e a rotina do estabelecimento em um só lugar.'

    document.title = title

    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.querySelector<HTMLMetaElement>(selector)
      if (el) el.setAttribute(attr, value)
    }

    setMeta('meta[name="description"]', 'content', description)
    setMeta('meta[property="og:title"]', 'content', title)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:url"]', 'content', canonicalUrl)

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) canonical.href = canonicalUrl

    return () => {
      document.title = 'onefind · Gestão para pet shops e banho e tosa'
    }
  }, [location.pathname])

  return (
    <div className="min-h-screen overflow-hidden bg-paper text-ink">
      <header className="border-b border-paper-dark bg-paper px-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 py-4">
          <Link to="/" className="font-display text-3xl tracking-wider text-ink">
            onefind
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/entrar" className="text-sm text-ink-muted transition-colors hover:text-ink">
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
            Gestão para pet shops e banho e tosa
          </p>
          <h1 className="font-display text-6xl leading-[.86] text-ink sm:text-8xl lg:text-9xl">
            onefind
          </h1>
          <p className="mt-5 font-display text-3xl leading-none tracking-wide text-ink sm:text-4xl">
            CLIENTES, PETS E ATENDIMENTOS ORGANIZADOS.
          </p>
          <div className="neutral-rule mx-auto my-8 max-w-md" aria-hidden="true" />
          <p className="mx-auto max-w-xl text-base leading-7 text-ink-muted sm:text-lg">
            Centralize clientes, pets, serviços, histórico e rotina do estabelecimento sem depender
            de informações espalhadas. O fluxo pode ser ajustado pela própria operação do pet shop.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to={signupPath}
              className="rounded bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition-colors hover:bg-accent-soft"
            >
              Testar grátis por 30 dias
              <CtaArrow />
            </Link>
            <a
              href="#solucoes"
              className="rounded border border-ink/20 bg-paper/70 px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
            >
              Conhecer o onefind
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
              Feito para a rotina pet
            </p>
            <h2 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
              MAIS CONTROLE A CADA ATENDIMENTO
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm">
              <p className="font-mono text-xs text-pet">01 · CLIENTES E PETS</p>
              <h3 className="mt-5 font-display text-3xl text-ink">TUDO LIGADO AO PET</h3>
              <p className="mt-4 text-sm leading-7 text-ink-muted">
                Cadastro de tutores e pets com informações importantes para o atendimento.
              </p>
            </article>
            <article className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm">
              <p className="font-mono text-xs text-pet">02 · HISTÓRICO</p>
              <h3 className="mt-5 font-display text-3xl text-ink">O ATENDIMENTO FICA REGISTRADO</h3>
              <p className="mt-4 text-sm leading-7 text-ink-muted">
                Consulte serviços, observações e histórico quando o pet voltar ao estabelecimento.
              </p>
            </article>
            <article className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm">
              <p className="font-mono text-xs text-pet">03 · ROTINA</p>
              <h3 className="mt-5 font-display text-3xl text-ink">A OPERAÇÃO DEFINE O FLUXO</h3>
              <p className="mt-4 text-sm leading-7 text-ink-muted">
                Organize serviços, equipe e atendimentos respeitando avaliação, duração e rotina de cada negócio.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-paper px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 max-w-xl">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
              Um só lugar
            </p>
            <h2 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
              MENOS INFORMAÇÃO ESPALHADA.
              <br />
              MAIS ORGANIZAÇÃO.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-paper-dark bg-white p-7 shadow-sm sm:p-9">
              <p className="font-mono text-xs text-ink-muted">01 · CLIENTE</p>
              <h3 className="mt-6 font-display text-4xl text-ink">UM LINK PARA O SEU ESTABELECIMENTO</h3>
              <ul className="mt-5 space-y-3 text-sm text-ink-muted">
                <li className="flex items-start gap-2"><ListMark />Link público para divulgar onde seus clientes já estão</li>
                <li className="flex items-start gap-2"><ListMark />Informações do estabelecimento e serviços em um só lugar</li>
                <li className="flex items-start gap-2"><ListMark />Fluxo adaptado à forma como seu negócio atende</li>
              </ul>
            </article>
            <article className="rounded-lg bg-ink p-7 text-paper shadow-sm sm:p-9">
              <p className="font-mono text-xs text-paper/55">02 · GESTÃO</p>
              <h3 className="mt-6 font-display text-4xl">GERENCIE A ROTINA PET</h3>
              <ul className="mt-5 space-y-3 text-sm text-paper/70">
                <li className="flex items-start gap-2"><ListMark />Clientes, pets e histórico</li>
                <li className="flex items-start gap-2"><ListMark />Equipe, serviços e atendimentos</li>
                <li className="flex items-start gap-2"><ListMark />Financeiro e informações do negócio</li>
              </ul>
              <Link to={signupPath} className="mt-8 inline-block text-sm font-semibold text-paper hover:text-paper/80">
                Testar o onefind
                <CtaArrow />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="border-y border-paper-dark bg-paper-dark px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
            Comece sem complicação
          </p>
          <h2 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
            COMO FUNCIONA
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([number, title, description]) => (
              <article key={number} className="bg-paper p-6">
                <p className="font-mono text-xs text-ink-muted">{number}</p>
                <h3 className="mt-12 font-display text-2xl leading-none text-ink">{title.toUpperCase()}</h3>
                <p className="mt-3 text-base leading-7 text-ink-muted">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <ReferralLandingSection variant="pet" />
        </div>
      </section>

      <section className="bg-ink px-4 py-20 text-center sm:py-28">
        <div className="mx-auto max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-paper/50">
            onefind para negócios pet
          </p>
          <h2 className="mt-4 font-display text-6xl leading-[.88] text-paper sm:text-7xl">
            EXPERIMENTE GRÁTIS POR 30 DIAS.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-paper/65">
            Organize seu estabelecimento e veja se o onefind faz sentido para sua rotina.
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
        <p className="font-display text-2xl tracking-wider text-ink">onefind</p>
        <p className="mt-2">Gestão para pet shops, banho e tosa e outros negócios pet.</p>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to="/" className="hover:text-ink">Início</Link>
          <Link to="/faq" className="hover:text-ink">Perguntas frequentes</Link>
          <Link to="/privacidade" className="hover:text-ink">Política de Privacidade</Link>
          <Link to={signupPath} className="hover:text-ink">Cadastre seu negócio pet</Link>
        </p>
      </footer>
    </div>
  )
}
