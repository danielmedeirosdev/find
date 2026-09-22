import { useState } from "react";
import { AppIcon } from "./AppIcon";
import { trackFunnel } from "../lib/analytics";
export function SetupChoice({ onManual }: { onManual: () => void }) {
  const [assisted, setAssisted] = useState(false);
  const [message, setMessage] = useState(
    "Oi! Quero começar no onefind com configuração assistida.",
  );
  const manual = () => {
    trackFunnel("setup_choice", { method: "manual" });
    trackFunnel("setup_manual_start");
    onManual();
  };
  return (
    <section className="setup-choice panel-enter">
      <div className="setup-progress" aria-label="Configuração inicial">
        <span className="current">1 · Configuração</span>
        <span>2 · Seu negócio</span>
        <span>3 · Pronto</span>
      </div>
      {assisted ? (
        <>
          <span className="setup-symbol">
            <AppIcon name="help" size={32} />
          </span>
          <h1>
            Vamos te ajudar
            <br />a configurar.
          </h1>
          <p>
            Converse com um assistente pelo WhatsApp para receber ajuda na
            configuração inicial do seu negócio.
          </p>
          <div className="assisted-message">
            <label htmlFor="setup-message">
              Mensagem para o assistente <span>Você pode editar</span>
            </label>
            <textarea
              id="setup-message"
              rows={3}
              maxLength={1500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <a
              className="premium-button whatsapp-button"
              href={`https://wa.me/5519974280798?text=${encodeURIComponent(message.trim() || "Oi! Quero começar no onefind com configuração assistida.")}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackFunnel("setup_whatsapp_open")}
            >
              Abrir WhatsApp <AppIcon name="arrow-right" size={18} />
            </a>
          </div>
          <p className="setup-note">
            O primeiro passo é simples. A configuração completa depende das
            informações do seu negócio e da disponibilidade do atendimento.
          </p>
          <div className="setup-bottom-actions">
            <button type="button" onClick={() => setAssisted(false)}>
              Voltar
            </button>
            <button type="button" onClick={manual}>
              Continuar por conta própria
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="premium-eyebrow">Bem-vindo ao onefind</p>
          <h1>Como você quer configurar?</h1>
          <p>Escolha o melhor começo para o seu negócio.</p>
          <div className="setup-options">
            <button type="button" onClick={manual}>
              <AppIcon name="settings" size={26} />
              <span>
                <strong>Configurar sozinho</strong>
                <small>Siga o passo a passo no seu ritmo.</small>
              </span>
              <AppIcon name="arrow-right" size={20} />
            </button>
            <button
              type="button"
              onClick={() => {
                setAssisted(true);
                trackFunnel("setup_choice", { method: "assisted" });
              }}
            >
              <AppIcon name="help" size={26} />
              <span>
                <strong>Configuração com assistente</strong>
                <small>Receba ajuda humana pelo WhatsApp.</small>
              </span>
              <AppIcon name="arrow-right" size={20} />
            </button>
          </div>
          <p className="setup-note">
            Você pode seguir sozinho a qualquer momento.
          </p>
        </>
      )}
    </section>
  );
}
