import { BrandLogo } from "../../components/BrandLogo";
import { MarketingHeader } from "../../components/MarketingHeader";
import { HeroTitle } from "../../components/HeroTitle";
import { AppIcon } from "../../components/AppIcon";
import { trackFunnel } from "../../lib/analytics";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { CtaArrow } from "../../components/SegmentMark";
import { ReferralLandingSection } from "../../components/ReferralLandingSection";

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

  return (
    <div className="premium-landing">
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
              Mais cuidado com os pets.
              <br />
              Mais controle da sua rotina.
            </p>
            <p className="hero-detail">
              Clientes, pets, serviços e atendimentos em um só lugar. Do seu
              jeito, no ritmo do seu negócio.
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
          <div
            className="product-overview"
            aria-label="O que você organiza no onefind"
          >
            <div className="product-overview-top">
              <BrandLogo />
              <span>Seu negócio, organizado.</span>
            </div>
            <div className="product-overview-body">
              <p className="premium-eyebrow">Tudo conectado ao cuidado</p>
              <h2>
                Uma rotina
                <br />
                mais tranquila.
              </h2>
              <div className="product-capability">
                <span className="capability-icon">
                  <AppIcon name="paw" size={24} />
                </span>
                <div>
                  <strong>Clientes e pets</strong>
                  <p>Informações e histórico sempre à mão</p>
                </div>
              </div>
              <div className="product-capability">
                <span className="capability-icon">
                  <AppIcon name="agenda" size={24} />
                </span>
                <div>
                  <strong>Atendimentos</strong>
                  <p>Você define como e quando atender</p>
                </div>
              </div>
              <div className="product-capability">
                <span className="capability-icon">
                  <AppIcon name="wallet" size={24} />
                </span>
                <div>
                  <strong>Seu negócio</strong>
                  <p>Serviços, equipe e financeiro juntos</p>
                </div>
              </div>
              <div className="product-footnote">
                <AppIcon name="check" size={17} /> Organização que acompanha o
                seu cuidado.
              </div>
            </div>
          </div>
        </section>
        <section className="premium-section" id="negocio">
          <div className="section-heading">
            <p className="premium-eyebrow">Para seu negócio</p>
            <h2>
              Você cuida dos pets.
              <br />
              <span>A rotina fica organizada.</span>
            </h2>
            <p>
              Do banho e tosa aos cuidados do dia a dia, mantenha as informações
              do estabelecimento conectadas.
            </p>
          </div>
          <div className="premium-features" id="recursos">
            {[
              [
                "paw",
                "Cada pet tem sua história.",
                "Consulte tutores, observações e histórico de atendimentos quando precisar.",
              ],
              [
                "agenda",
                "A sua operação define o ritmo.",
                "Organize atendimentos respeitando avaliação, duração e a rotina do seu pet shop.",
              ],
              [
                "wallet",
                "Tudo perto de você.",
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
              Do primeiro acesso
              <br />
              <span>à sua rotina.</span>
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
              <p className="premium-eyebrow">Simples desde o começo</p>
              <h2>
                Conheça na prática.
                <br />
                30 dias por nossa conta.
              </h2>
              <p>Experimente o onefind na rotina do seu estabelecimento.</p>
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
        <section className="premium-section referral-section">
          <ReferralLandingSection variant="pet" />
        </section>
      </main>
      <footer className="premium-footer">
        <Link to="/">
          <BrandLogo />
        </Link>
        <p>Negócios que cuidam, sempre encontram.</p>
        <nav aria-label="Rodapé">
          <Link to="/faq">Ajuda</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/entrar">Sou cliente</Link>
        </nav>
      </footer>
    </div>
  );
}
