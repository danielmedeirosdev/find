import { SessionAccount } from './SessionAccount'
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation()

  const handleHomeClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname !== '/') return
    event.preventDefault()
    document.getElementById('inicio')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header className="premium-header" onKeyDown={event => { if (event.key === "Escape") setOpen(false) }}>
      <div className="premium-nav">
        <Link to="/#inicio" aria-label="onefind — início" onClick={handleHomeClick}>
          <BrandLogo />
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="/#negocio">Para seu negócio</a>
          <a href="/#recursos">Recursos</a>
          <a href="/#planos">Planos</a>
          <Link to="/faq">Ajuda</Link>
        </nav>
        <div className="nav-actions">
          <SessionAccount />
          <button
            className="mobile-menu-toggle"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{open ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 8h16M4 16h16" />}</svg>
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
