import { useState } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="premium-header">
      <div className="premium-nav">
        <Link to="/" aria-label="onefind — início">
          <BrandLogo />
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="/#negocio">Para seu negócio</a>
          <a href="/#recursos">Recursos</a>
          <a href="/#planos">Planos</a>
          <Link to="/faq">Ajuda</Link>
        </nav>
        <div className="nav-actions">
          <Link className="login-link" to="/painel">
            Entrar
          </Link>
          <button
            className="mobile-menu-toggle"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? "Fechar" : "Menu"}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-navigation"
          className="mobile-navigation"
          aria-label="Navegação mobile"
          onClick={() => setOpen(false)}
        >
          <a href="/#negocio">Para seu negócio</a>
          <a href="/#recursos">Recursos</a>
          <a href="/#planos">Planos</a>
          <Link to="/faq">Ajuda</Link>
          <Link to="/entrar">Sou cliente</Link>
        </nav>
      )}
    </header>
  );
}
