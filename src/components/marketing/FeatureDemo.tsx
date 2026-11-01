import { AppIcon } from "../AppIcon";
import { features, type FeatureId } from "./content";

export function FeatureDemo({ id }: { id: FeatureId }) {
  const feature = features.find((f) => f.id === id)!;
  return (
    <div className="mkt-demo" key={id}>
      <div className="mkt-demo-top">
        <span>
          <AppIcon name="paw" size={17} />
          onefind
        </span>
        <span>{feature.label}</span>
        <i aria-hidden="true" />
      </div>
      <div className="mkt-demo-content">
        {id === "agenda" && (
          <>
            <div className="mkt-demo-heading">
              <div>
                <small>SUA AGENDA</small>
                <h3>Um dia bem cuidado.</h3>
              </div>
              <AppIcon name="agenda" size={26} />
            </div>
            <div className="mkt-demo-week">
              {["SEG", "TER", "QUA", "QUI", "SEX"].map((d, i) => (
                <span className={i === 2 ? "is-current" : ""} key={d}>
                  {d}
                  <b>{12 + i}</b>
                </span>
              ))}
            </div>
            <div className="mkt-demo-appointments">
              {[
                ["09:00", "Luna", "Banho + hidratação", "60 min"],
                ["10:00", "Theo", "Banho e tosa", "90 min"],
                ["11:30", "Mel", "Banho · pacote", "60 min"],
              ].map(([time, pet, service, duration]) => (
                <div className="mkt-arrive" key={pet}>
                  <time>{time}</time>
                  <div>
                    <strong>{pet}</strong>
                    <p>{service}</p>
                  </div>
                  <small>{duration}</small>
                </div>
              ))}
            </div>
          </>
        )}
        {id === "clientes-e-pets" && (
          <>
            <div className="mkt-demo-heading">
              <div>
                <small>CLIENTES E PETS</small>
                <h3>Conheça quem chega.</h3>
              </div>
              <AppIcon name="heart" size={26} />
            </div>
            <div className="mkt-pet-profile mkt-arrive">
              <span className="mkt-pet-avatar">
                <AppIcon name="paw" size={32} />
              </span>
              <div>
                <h4>Luna</h4>
                <p>Poodle · porte pequeno</p>
                <small>Tutora: Marina</small>
              </div>
            </div>
            <div className="mkt-demo-note mkt-arrive">
              <small>OBSERVAÇÕES</small>
              <p>Secar com cuidado na região das orelhas.</p>
            </div>
            <div className="mkt-demo-note mkt-arrive">
              <small>ÚLTIMO ATENDIMENTO</small>
              <p>
                Banho + hidratação <span className="mkt-badge">Concluído</span>
              </p>
            </div>
          </>
        )}
        {id === "servicos" && (
          <>
            <div className="mkt-demo-heading">
              <div>
                <small>DURAÇÃO FLEXÍVEL</small>
                <h3>Cabe no mesmo horário.</h3>
              </div>
              <AppIcon name="clock" size={26} />
            </div>
            <div className="mkt-time-block mkt-arrive">
              <span>09:00</span>
              <div>
                <strong>60 minutos</strong>
                <small>Tempo reservado</small>
              </div>
              <span>10:00</span>
            </div>
            <div className="mkt-service-lines">
              <div className="mkt-arrive">
                <AppIcon name="check" />
                Banho<span>Principal</span>
              </div>
              <div className="mkt-arrive">
                <AppIcon name="check" />
                Hidratação<span>Adicional</span>
              </div>
              <div className="mkt-arrive">
                <AppIcon name="check" />
                Higiene<span>Adicional</span>
              </div>
            </div>
            <p className="mkt-demo-footnote">
              Extras dentro do período reservado.
            </p>
          </>
        )}
        {id === "pacotes" && (
          <>
            <div className="mkt-demo-heading">
              <div>
                <small>PACOTES</small>
                <h3>O próximo banho já tem lugar.</h3>
              </div>
              <AppIcon name="package" size={26} />
            </div>
            <div className="mkt-package-card mkt-arrive">
              <small>PACOTE DA LUNA</small>
              <h4>4 sessões de banho</h4>
              <div className="mkt-session-dots">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={i < 2 ? "used" : ""}>
                    {i < 2 ? <AppIcon name="check" /> : i + 1}
                  </span>
                ))}
              </div>
              <p>
                <strong>2 usadas</strong>
                <span>2 restantes</span>
              </p>
            </div>
            <div className="mkt-demo-note mkt-arrive">
              <AppIcon name="check" />
              <p>Sessão registrada no atendimento.</p>
            </div>
          </>
        )}
        {id === "financeiro" && (
          <>
            <div className="mkt-demo-heading">
              <div>
                <small>FINANCEIRO</small>
                <h3>Saiba o que entrou.</h3>
              </div>
              <AppIcon name="wallet" size={26} />
            </div>
            <div className="mkt-money-grid">
              <div className="mkt-arrive">
                <small>Recebido</small>
                <strong>R$ 60</strong>
                <span>Pagamento parcial</span>
              </div>
              <div className="mkt-arrive">
                <small>A receber</small>
                <strong>R$ 20</strong>
                <span>Saldo pendente</span>
              </div>
            </div>
            <div className="mkt-demo-note mkt-arrive">
              <div>
                <strong>Banho + hidratação</strong>
                <p>Total do atendimento: R$ 80</p>
              </div>
              <span className="mkt-badge">Concluído</span>
            </div>
            <div className="mkt-demo-progress" aria-hidden="true">
              <i />
            </div>
            <p className="mkt-demo-footnote">
              Atendimento concluído. Saldo ainda em aberto.
            </p>
          </>
        )}
        {id === "equipe" && (
          <>
            <div className="mkt-demo-heading">
              <div>
                <small>EQUIPE</small>
                <h3>A rotina é compartilhada.</h3>
              </div>
              <AppIcon name="users" size={26} />
            </div>
            {[
              ["Ana", "Proprietária", "Agenda e financeiro"],
              ["João", "Profissional", "Atendimentos"],
            ].map(([name, role, access]) => (
              <div className="mkt-team-row mkt-arrive" key={name}>
                <span>{name[0]}</span>
                <div>
                  <strong>{name}</strong>
                  <p>{role}</p>
                </div>
                <small>{access}</small>
              </div>
            ))}
            <div className="mkt-demo-note mkt-arrive">
              <AppIcon name="shield" />
              <p>Cada pessoa com seu próprio acesso.</p>
            </div>
          </>
        )}
      </div>
      <div className="mkt-demo-bottom">
        <span>
          <i />
          Demonstração ilustrativa
        </span>
        <span>Dados fictícios</span>
      </div>
    </div>
  );
}
