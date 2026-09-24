import { BrandLogo } from "../../components/BrandLogo";
import { MarketingHeader } from "../../components/MarketingHeader";
import { HeroTitle } from "../../components/HeroTitle";
import { AppIcon } from "../../components/AppIcon";
import { trackFunnel } from "../../lib/analytics";
import { useEffect, useRef, useState } from "react";
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
  const heroRef = useRef<HTMLElement>(null);
  const [showMobileCta, setShowMobileCta] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShowMobileCta(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);
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
        <section className="premium-hero" id="inicio" ref={heroRef}>
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
              Chega de procurar recados no WhatsApp e conferir a agenda no caderno. Reúna clientes, pets, atendimentos e financeiro em um só lugar.
            </p>
            <Link
              to={signupPath}
              className="premium-button"
              onClick={() => trackFunnel("landing_cta", { placement: "hero" })}
            >
              Testar 30 dias grátis <CtaArrow />
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
              Menos recados perdidos.<br /><span>Mais controle da sua rotina.</span>
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
                "Encontre o contato do tutor e os cuidados de cada pet sem procurar em conversas antigas.",
              ],
              [
                "agenda",
                "Agenda de atendimentos",
                "Organize atendimentos respeitando avaliação, duração e a rotina do seu pet shop.",
              ],
              [
                "wallet",
                "Equipe e financeiro",
                "Veja os serviços realizados, quem atendeu e os valores recebidos sem juntar anotações no fim do dia.",
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
          <Link to={signupPath} className="premium-button getting-started-cta" onClick={() => trackFunnel("landing_cta", { placement: "getting_started" })}>
            Testar 30 dias grátis <CtaArrow />
          </Link>
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
              <ul className="plan-inclusions" aria-label="O que está incluído no plano">
                <li>Cadastro de clientes e pets, com histórico e observações</li>
                <li>Agenda e gestão dos atendimentos</li>
                <li>Serviços, preços e organização da equipe</li>
                <li>Controle financeiro do estabelecimento</li>
                <li>Página da loja, link de agendamento e QR code</li>
              </ul>
            </div>
            <div className="pricing-action">
              <Link
                className="premium-button"
                to={signupPath}
                onClick={() =>
                  trackFunnel("landing_cta", { placement: "pricing" })
                }
              >
                Testar 30 dias grátis <CtaArrow />
              </Link>
              <p>Sem cartão para começar.</p>
              <a href="#duvidas">Tire suas dúvidas</a>
            </div>
          </div>
        </section>
        <section className="premium-section landing-faq" id="duvidas">
          <div className="section-heading">
            <p className="premium-eyebrow">Antes de começar</p>
            <h2>Suas dúvidas, respondidas.</h2>
          </div>
          <div className="faq-questions">
            <details><summary>Preciso de cartão para testar?<span aria-hidden="true">+</span></summary><p>Não. Você tem 30 dias grátis, sem cadastrar cartão. Depois do teste, o plano custa R$ 60 por mês, por estabelecimento.</p></details>
            <details><summary>Como solicito o cancelamento?<span aria-hidden="true">+</span></summary><p>Durante o teste, não há assinatura paga para cancelar. Se você já assinou, <a href="https://wa.me/5519974280798" target="_blank" rel="noreferrer">fale com o atendimento</a> para solicitar o cancelamento e conferir a situação das cobranças.</p></details>
            <details><summary>Tem ajuda para trazer meus dados e configurar?<span aria-hidden="true">+</span></summary><p>Você pode escolher a configuração com assistente e receber orientação humana pelo WhatsApp. Conte como guarda seus cadastros hoje para combinar o que pode ser transferido e como será feito.</p></details>
            <details><summary>Posso avaliar o pet antes de confirmar o horário?<span aria-hidden="true">+</span></summary><p>Sim. Você define os serviços, a duração e a disponibilidade. Quando precisar de uma avaliação, combine os detalhes com o tutor antes de registrar ou confirmar o atendimento.</p></details>
          </div>
          <Link className="all-questions" to="/faq">Ver todas as perguntas</Link>
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
      {showMobileCta && <div className="mobile-signup-bar">
        <Link to={signupPath} className="premium-button" onClick={() => trackFunnel("landing_cta", { placement: "mobile_sticky" })}>Testar 30 dias grátis <CtaArrow /></Link>
        <p>Sem cartão para começar</p>
      </div>}
    </div>
  );
}
