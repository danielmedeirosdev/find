import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandLogo } from "../BrandLogo";
import { AppIcon } from "../AppIcon";
import { useAuth } from "../../contexts/AuthContext";
import { SessionAccount } from "../SessionAccount";
import { trackFunnel } from "../../lib/analytics";
import { features, signupPath } from "./content";
import "./story.css";

export function StoryHeader() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <header
      className="mkt-header"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="mkt-nav">
        <Link to="/#inicio" aria-label="onefind — início">
          <BrandLogo />
        </Link>
        <nav className="mkt-desktop-nav" aria-label="Navegação principal">
          <a href="/#recursos">Conhecer os recursos</a>
          <a href="/#como-funciona">Como funciona</a>
          <a href="/#planos">Plano</a>
          <Link to="/faq">Ajuda</Link>
        </nav>
        <div className="mkt-nav-actions">
          {user || loading ? (
            <SessionAccount />
          ) : (
            <Link to="/painel" className="mkt-nav-start">
              Entrar <AppIcon name="arrow-right" size={16} />
            </Link>
          )}
          <button
            ref={toggle}
            className="mkt-menu-toggle"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="mkt-menu"
            onClick={() => setOpen(!open)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? (
                <path d="m6 6 12 12M18 6 6 18" />
              ) : (
                <path d="M4 8h16M4 16h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav
          key={location.pathname}
          id="mkt-menu"
          className="mkt-menu"
          aria-label="Menu de recursos"
          onClick={() => setOpen(false)}
        >
          <p className="mkt-menu-label">Conhecer o onefind</p>
          <a href="/#recursos">Conhecer os recursos</a>
          <a href="/#como-funciona">Como funciona</a>
          <a href="/#planos">Plano e preço</a>
          <Link to="/faq">Dúvidas</Link>
        </nav>
      )}
    </header>
  );
}
export function StartLink({
  placement,
  children = "Testar 30 dias grátis",
}: {
  placement: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      className="mkt-button"
      to={signupPath}
      onClick={() => trackFunnel("landing_cta", { placement })}
    >
      {children}
      <AppIcon name="arrow-right" size={20} />
    </Link>
  );
}
export function StoryFooter() {
  return (
    <footer className="mkt-footer mkt-container">
      <div>
        <Link to="/#inicio">
          <BrandLogo />
        </Link>
        <p>
          Mais tempo para cuidar.
          <br />
          Mais clareza para gerir.
        </p>
      </div>
      <nav aria-label="Recursos do onefind">
        <span>Recursos</span>
        {features.map((f) => (
          <Link key={f.id} to={`/recursos/${f.id}`}>
            {f.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Sobre o onefind">
        <span>onefind</span>
        <a href="/#como-funciona">Como funciona</a>
        <a href="/#planos">Plano</a>
        <Link to="/faq">Ajuda</Link>
        <Link to="/privacidade">Privacidade</Link>
        <Link to="/painel">Acessar painel</Link>
        <Link to="/entrar">Sou tutor</Link>
      </nav>
      <small>© {new Date().getFullYear()} onefind</small>
    </footer>
  );
}
