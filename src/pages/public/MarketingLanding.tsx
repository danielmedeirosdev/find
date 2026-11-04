import { GoogleSignInButton } from "../../components/GoogleSignInButton";
import { completeGoogleCredentialLogin } from "../../lib/oauth";
import { useAuth } from "../../contexts/AuthContext";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  useMarketingMeta,
  useMarketingScroll,
  useScrollRails,
} from "../../components/marketing/hooks";
import { HeroTitle } from "../../components/HeroTitle";
import { AppIcon } from "../../components/AppIcon";
import { features } from "../../components/marketing/content";
import { FeatureDemo } from "../../components/marketing/FeatureDemo";
import {
  StoryHeader,
  StoryFooter,
  StartLink,
} from "../../components/marketing/StoryShell";

const faqs = [
  [
    "Preciso de cartão para testar?",
    "Não. São 30 dias grátis, sem cadastrar cartão. Depois, o plano custa R$ 60 por mês, por estabelecimento.",
  ],
  [
    "Posso continuar agendando pelo WhatsApp?",
    "Sim. Combine com o tutor e registre pelo painel. Você também pode compartilhar o link do estabelecimento para receber agendamentos.",
  ],
  [
    "Consigo usar pelo celular?",
    "Sim. Você acessa o onefind pelo navegador do celular ou do computador.",
  ],
  [
    "E se o cliente pagar depois?",
    "Você conclui o atendimento e deixa o valor pendente. Quando receber, registra o pagamento, inclusive parcial.",
  ],
  [
    "Vocês ajudam na configuração?",
    "Sim. A configuração assistida oferece orientação humana para preparar o estabelecimento.",
  ],
];
export function MarketingLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [googleError, setGoogleError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [active, setActive] = useState(0);
  const railsRef = useScrollRails();
  const { pathname } = useLocation();
  const feature = features[active];
  useMarketingMeta(
    "onefind · Gestão para pet shops e banho e tosa",
    "Agenda, clientes, pets, pacotes e financeiro em um só lugar. Conheça o onefind e teste 30 dias grátis, sem cartão.",
    pathname === "/pet" ? "/pet" : "/",
  );
  useMarketingScroll();
  return (
    <div className="mkt-site">
      <StoryHeader />
      <main>
        <section className="mkt-hero" id="inicio">
          <img
            className="mkt-hero-image"
            src="/assets/marketing/onefind-studio-mobile.webp"
            alt=""
            width="1024"
            height="1536"
            fetchPriority="high"
          />
          <div className="mkt-hero-shade" />
          <div className="mkt-hero-copy">
            <p className="mkt-eyebrow">ONEFIND / BANHO E TOSA</p>
            <HeroTitle />
            <p className="mkt-hero-description">
              Agenda, clientes e financeiro.
              <br />
              Seu banho e tosa em um só lugar.
            </p>
            <div className="mkt-hero-actions">
              <StartLink placement="hero" />
              {!user && (
                <div className="mkt-google">
                  <GoogleSignInButton
                    disabled={googleBusy}
                    onError={setGoogleError}
                    onCredential={async (response, nonce) => {
                      setGoogleBusy(true);
                      setGoogleError("");
                      try {
                        const result = await completeGoogleCredentialLogin(
                          "barber",
                          response,
                          nonce,
                          "Meu Pet Shop",
                          "pet",
                        );
                        navigate(result.redirectTo);
                      } catch (error) {
                        setGoogleError(
                          error instanceof Error
                            ? error.message
                            : "Não foi possível entrar. Tente pelo cadastro.",
                        );
                        setGoogleBusy(false);
                      }
                    }}
                  />
                </div>
              )}
            </div>
            <p className="mkt-hero-terms">
              30 dias grátis <i /> Sem cartão
            </p>
            {googleError && (
              <p className="mkt-google-error" role="alert">
                Google indisponível.{" "}
                <Link to="/painel?segment=pet&modo=cadastro">
                  Continuar com e-mail
                </Link>
              </p>
            )}
          </div>
          <a className="mkt-scroll-hint" href="#negocio">
            Conheça o onefind <span>↓</span>
          </a>
        </section>
        <section className="mkt-intro" id="negocio">
          <div className="mkt-container mkt-centered">
            <p className="mkt-eyebrow">
              DO PRIMEIRO HORÁRIO AO ÚLTIMO RECEBIMENTO
            </p>
            <h2>
              Uma rotina inteira.
              <br />
              <span>Tudo se conecta.</span>
            </h2>
            <p>
              Do cadastro do pet ao pagamento.
              <br />
              Encontre o que precisa, sem juntar anotações.
            </p>
          </div>
          <div
            className="mkt-rails"
            ref={railsRef}
            aria-label="Explore os recursos"
          >
            <div className="mkt-rail">
              {features.map((f) => (
                <Link key={f.id} to={`/recursos/${f.id}`}>
                  <AppIcon name={f.icon} size={25} />
                  {f.label}
                  <AppIcon name="arrow-right" size={16} />
                </Link>
              ))}
            </div>
            <div className="mkt-rail mkt-rail-reverse">
              {[
                features[3],
                features[4],
                features[5],
                features[0],
                features[1],
                features[2],
              ].map((f) => (
                <Link key={f.id} to={`/recursos/${f.id}`}>
                  <AppIcon name={f.icon} size={25} />
                  {f.label}
                  <AppIcon name="arrow-right" size={16} />
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="mkt-showcase mkt-container" id="recursos">
          <div className="mkt-centered mkt-section-heading">
            <p className="mkt-eyebrow">VEJA NA PRÁTICA</p>
            <h2>
              Feito para o seu
              <br />
              <span>dia a dia.</span>
            </h2>
            <p>Escolha um recurso e veja como ele ajuda.</p>
          </div>
          <div
            className="mkt-feature-tabs"
            role="tablist"
            aria-label="Recursos do onefind"
          >
            {features.map((f, i) => (
              <button
                key={f.id}
                type="button"
                id={`tab-${f.id}`}
                role="tab"
                aria-selected={active === i}
                aria-controls="feature-panel"
                tabIndex={active === i ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  let next: number;
                  if (e.key === "ArrowRight") next = (i + 1) % features.length;
                  else if (e.key === "ArrowLeft")
                    next = (i + features.length - 1) % features.length;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = features.length - 1;
                  else return;
                  e.preventDefault();
                  setActive(next);
                  document.getElementById(`tab-${features[next].id}`)?.focus();
                }}
              >
                <AppIcon name={f.icon} size={23} />
                <span>{f.label}</span>
              </button>
            ))}
          </div>
          <div
            className="mkt-feature-panel"
            role="tabpanel"
            id="feature-panel"
            aria-labelledby={`tab-${feature.id}`}
            tabIndex={0}
          >
            <FeatureDemo id={feature.id} />
            <div className="mkt-feature-copy" key={feature.id}>
              <p className="mkt-eyebrow">
                0{active + 1} / {feature.label}
              </p>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <Link className="mkt-text-link" to={`/recursos/${feature.id}`}>
                Conhecer {feature.label.toLocaleLowerCase("pt-BR")}
                <AppIcon name="arrow-right" size={19} />
              </Link>
            </div>
          </div>
        </section>
        <section className="mkt-how mkt-container" id="como-funciona">
          <div className="mkt-section-heading">
            <p className="mkt-eyebrow">UM COMEÇO SIMPLES</p>
            <h2>
              Do seu jeito.
              <br />
              <span>No seu tempo.</span>
            </h2>
          </div>
          <div className="mkt-steps">
            {[
              [
                "01",
                "Prepare seu espaço",
                "Crie sua conta e cadastre os serviços, horários e profissionais.",
              ],
              [
                "02",
                "Traga sua rotina",
                "Adicione clientes e pets. Registre os próximos atendimentos.",
              ],
              [
                "03",
                "Cuide do dia a dia",
                "Acompanhe a agenda, conclua os serviços e confira os pagamentos.",
              ],
            ].map(([n, t, d]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
          <div className="mkt-assistance">
            <AppIcon name="heart" />
            <p>
              Quer ajuda no começo? <strong>Tem configuração assistida.</strong>
            </p>
            <StartLink placement="assistance">Começar com o onefind</StartLink>
          </div>
        </section>
        <section className="mkt-price-section" id="planos">
          <div className="mkt-container mkt-price-layout">
            <div className="mkt-section-heading">
              <p className="mkt-eyebrow">UM PLANO. SUA ROTINA COMPLETA.</p>
              <h2>
                Primeiro, conheça.
                <br />
                <span>Depois, decida.</span>
              </h2>
              <p>
                Teste por 30 dias sem cartão.
                <br />
                Veja como o onefind se encaixa no seu negócio.
              </p>
              <div className="mkt-plan-note">
                <AppIcon name="store" />
                <span>
                  Por estabelecimento.
                  <br />
                  No celular e no computador.
                </span>
              </div>
            </div>
            <div className="mkt-price-card">
              <div className="mkt-price-top">
                <span>onefind</span>
                <span>Plano mensal</span>
              </div>
              <p className="mkt-price">
                <strong>R$ 60</strong>
                <span>/mês</span>
              </p>
              <p className="mkt-after-trial">Após os 30 dias grátis</p>
              <ul>
                {[
                  "Agenda e agendamento pelo painel",
                  "Clientes, pets e histórico",
                  "Serviços e duração flexível",
                  "Pacotes e controle de sessões",
                  "Financeiro e pagamentos pendentes",
                  "Equipe com acessos separados",
                  "Página da loja e link de agendamento",
                  "Comprovante e mensagem para WhatsApp",
                ].map((t) => (
                  <li key={t}>
                    <AppIcon name="check" size={17} />
                    {t}
                  </li>
                ))}
              </ul>
              <StartLink placement="pricing" />
              <small>Sem cartão para começar.</small>
            </div>
          </div>
        </section>
        <section className="mkt-faq mkt-container" id="duvidas">
          <div className="mkt-section-heading">
            <p className="mkt-eyebrow">ANTES DE COMEÇAR</p>
            <h2>Ficou alguma dúvida?</h2>
          </div>
          <div>
            {faqs.map(([q, a], i) => (
              <details key={q}>
                <summary>
                  <span className="mkt-faq-number">0{i + 1}</span>
                  {q}
                  <span className="mkt-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
          <Link to="/faq" className="mkt-text-link">
            Ver todas as perguntas
            <AppIcon name="arrow-right" size={18} />
          </Link>
        </section>
        <section className="mkt-final mkt-container">
          <p className="mkt-eyebrow">PRONTO PARA O PRÓXIMO ATENDIMENTO</p>
          <h2>
            Seu cuidado faz a diferença.
            <br />
            <span>A organização também.</span>
          </h2>
          <StartLink placement="final" />
          <p>30 dias para conhecer. Sem cartão.</p>
        </section>
        <aside className="mkt-referral mkt-container">
          <span>Já usa o onefind?</span>
          <Link to="/painel/dashboard?aba=referral">
            Conheça o programa de indicação{" "}
            <AppIcon name="arrow-right" size={17} />
          </Link>
        </aside>
      </main>
      <StoryFooter />
    </div>
  );
}
