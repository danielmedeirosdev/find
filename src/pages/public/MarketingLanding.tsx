import { BrandLogo } from "../../components/BrandLogo";
import { MarketingHeader } from "../../components/MarketingHeader";
import { HeroTitle } from "../../components/HeroTitle";
import { AppIcon } from "../../components/AppIcon";
import { trackFunnel } from "../../lib/analytics";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { CtaArrow } from "../../components/SegmentMark";


const steps = [
  [
    "01",
    "Cadastre seu pet shop",
    "Crie sua conta e informe os dados básicos do estabelecimento.",
  ],
  [
    "02",
    "Organize sua operação",
    "Cadastre clientes, pets, serviços, equipe e a forma como você atende.",
  ],
  [
    "03",
    "Divulgue seu link",
    "Coloque o link do seu estabelecimento no Instagram, WhatsApp e Google.",
  ],
  [
    "04",
    "Gerencie os atendimentos",
    "Acompanhe a rotina, histórico dos pets e informações do negócio em um só lugar.",
  ],
];

export function MarketingLanding() {
  const location = useLocation();
  const signupPath = "/painel?segment=pet&modo=cadastro";

  useEffect(() => {
    const isPetPage = location.pathname === "/pet";
    const canonicalUrl = isPetPage
      ? "https://www.onefind.com.br/pet"
      : "https://www.onefind.com.br/";
    const title = isPetPage
      ? "onefind para Pet Shops e Banho e Tosa | Gestão PET"
      : "onefind · Gestão para pet shops e banho e tosa";
    const description = isPetPage
      ? "Gestão para pet shops e banho e tosa. Organize clientes, pets, serviços, atendimentos e histórico em um só lugar. Teste grátis por 30 dias."
      : "onefind é a plataforma de gestão para pet shops, banho e tosa e outros negócios pet. Organize clientes, pets, serviços, atendimentos e a rotina do estabelecimento em um só lugar.";

    document.title = title;

    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.querySelector<HTMLMetaElement>(selector);
      if (el) el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", canonicalUrl);

    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (canonical) canonical.href = canonicalUrl;

    return () => {
      document.title = "onefind · Gestão para pet shops e banho e tosa";
    };
  }, [location.pathname]);

  useEffect(() => {
    if (location.hash === '#inicio') {
      requestAnimationFrame(() => {
        document.getElementById('inicio')?.scrollIntoView({ behavior: 'instant' })
      })
    }
  }, [location.hash])

  return (
    <div className="premium-landing editorial-home">
      <MarketingHeader />
      <main>
        <section className="premium-hero" id="inicio">
          <div className="premium-hero-copy">
            <p className="premium-eyebrow">
              <AppIcon name="paw" size={17} /> Feito para pet shops e banho e
              tosa
            </p>
            <HeroTitle />
            <p className="hero-description">
              Gestão para pet shops<br />e banho e tosa.
            </p>
            <p className="hero-detail">
              Cadastros, atendimentos e financeiro reunidos para acompanhar o seu estabelecimento.
            </p>
            <Link
              to={signupPath}
              className="premium-button"
              onClick={() => trackFunnel("landing_cta", { placement: "hero" })}
            >
              Começar agora <CtaArrow />
            </Link>
            <p className="hero-terms">
              30 dias grátis <span>·</span> sem cartão
            </p>
            <p className="hero-assistance">Configuração assistida disponível</p>
          </div>
        </section>
        <section className="premium-section" id="negocio">
          <div className="section-heading">
            <p className="premium-eyebrow">Para seu negócio</p>
            <h2>
              O atendimento começa<br /><span>com as informações certas.</span>
            </h2>
            <p>
              Cada pet exige um cuidado diferente. Você define os serviços, os horários e os ajustes necessários após a avaliação.
            </p>
          </div>
          <div className="premium-features" id="recursos">
            {[
              [
                "paw",
                "Clientes e pets",
                "Consulte tutores, observações e histórico de atendimentos quando precisar.",
              ],
              [
                "agenda",
                "Agenda de atendimentos",
                "Organize atendimentos respeitando avaliação, duração e a rotina do seu pet shop.",
              ],
              [
                "wallet",
                "Equipe e financeiro",
                "Acompanhe serviços, equipe e financeiro no mesmo ambiente.",
              ],
            ].map(([icon, title, detail]) => (
              <article key={title}>
                <AppIcon name={icon as "paw" | "agenda" | "wallet"} size={26} />
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="premium-section getting-started">
          <div className="section-heading">
            <p className="premium-eyebrow">Um começo simples</p>
            <h2>
              Como começar
            </h2>
          </div>
          <div className="premium-steps">
            {steps.map(([number, title, description]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <p className="setup-note">
            Configure no seu tempo ou escolha receber ajuda humana na
            configuração inicial.
          </p>
        </section>
        <section className="premium-section" id="planos">
          <div className="premium-pricing">
            <div>
              <p className="premium-eyebrow">Plano mensal</p>
              <h2>
                Teste antes de assinar.
              </h2>
              <p>30 dias de acesso grátis. Sem cartão para iniciar.</p>
              <p className="price">
                <strong>R$ 60</strong> / mês após o teste
              </p>
            </div>
            <div className="pricing-action">
              <Link
                className="premium-button"
                to={signupPath}
                onClick={() =>
                  trackFunnel("landing_cta", { placement: "pricing" })
                }
              >
                Começar agora <CtaArrow />
              </Link>
              <p>Sem cartão para começar.</p>
              <Link to="/faq">Tire suas dúvidas</Link>
            </div>
          </div>
        </section>
        <section className="premium-section referral-compact" aria-label="Indicações"><h2>Já usa o onefind?</h2><p>Uma indicação que se torna assinante vale um mês grátis.</p><Link to="/painel/dashboard?aba=referral">Ver programa de indicação</Link></section>
      </main>
      <footer className="premium-footer">
        <Link to="/#inicio">
          <BrandLogo />
        </Link>
        <nav aria-label="Rodapé">
          <Link to="/faq">Ajuda</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/entrar">Sou cliente</Link>
        </nav>
      </footer>
    </div>
  );
}
