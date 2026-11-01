import { Link, useParams } from "react-router-dom";
import { features } from "../../components/marketing/content";
import { FeatureDemo } from "../../components/marketing/FeatureDemo";
import {
  StoryHeader,
  StoryFooter,
  StartLink,
} from "../../components/marketing/StoryShell";
import {
  useMarketingMeta,
  useMarketingScroll,
} from "../../components/marketing/hooks";
import { AppIcon } from "../../components/AppIcon";
import { NotFound } from "./NotFound";

export function FeaturePage() {
  const { featureId } = useParams();
  const feature = features.find((f) => f.id === featureId);
  useMarketingMeta(
    feature
      ? `${feature.label} para banho e tosa | onefind`
      : "Página não encontrada | onefind",
    feature?.description ?? "Conheça o onefind.",
    feature ? `/recursos/${feature.id}` : "/",
  );
  useMarketingScroll();
  if (!feature) return <NotFound />;
  return (
    <div className="mkt-site">
      <StoryHeader />
      <main>
        <section className="mkt-detail-hero mkt-container">
          <Link to="/#recursos" className="mkt-back">
            <AppIcon name="arrow-left" size={18} />
            Todos os recursos
          </Link>
          <div className="mkt-detail-grid">
            <div>
              <p className="mkt-eyebrow">ONEFIND / {feature.label}</p>
              <h1>{feature.title}</h1>
              <p>{feature.description}</p>
              <StartLink placement={`feature_${feature.id}`} />
              <small>30 dias grátis · Sem cartão</small>
            </div>
            <FeatureDemo id={feature.id} />
          </div>
        </section>
        <section
          className="mkt-detail-points mkt-container"
          aria-label={`Como funciona: ${feature.label}`}
        >
          {feature.points.map(([title, detail], i) => (
            <article key={title}>
              <span className="mkt-eyebrow">0{i + 1}</span>
              <h2>{title}</h2>
              <p>{detail}</p>
            </article>
          ))}
        </section>
        <section className="mkt-detail-question mkt-container">
          <AppIcon name="help" size={28} />
          <div>
            <h2>{feature.question}</h2>
            <p>{feature.answer}</p>
          </div>
        </section>
        <section className="mkt-related mkt-container">
          <p className="mkt-eyebrow">A ROTINA CONTINUA</p>
          <h2>Conheça também.</h2>
          <div>
            {features
              .filter((f) => f.id !== feature.id)
              .map((f) => (
                <Link to={`/recursos/${f.id}`} key={f.id}>
                  <AppIcon name={f.icon} />
                  {f.label}
                  <AppIcon name="arrow-right" size={17} />
                </Link>
              ))}
          </div>
        </section>
        <section className="mkt-final mkt-container">
          <h2>Veja na sua rotina.</h2>
          <StartLink placement={`feature_${feature.id}_final`} />
          <p>Depois do teste, R$ 60/mês por estabelecimento.</p>
        </section>
      </main>
      <StoryFooter />
    </div>
  );
}
