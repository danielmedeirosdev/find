import { createPortal } from 'react-dom'
import { DashboardHeaderContext } from '../contexts/DashboardHeaderContext'
import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { Shop } from "../lib/types";
export function BusinessAccount({
  shop,
  inHeader = true,
  access = "owner",
}: {
  shop: Pick<Shop, "name" | "logo_url">;
  inHeader?: boolean;
  access?: "owner" | "staff" | "account";
}) {
  const { signOut } = useAuth();
  const headerTarget = useContext(DashboardHeaderContext);
  const [open, setOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  if (inHeader && !headerTarget) return null;
  const content = (
    <div
      className="business-account"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="account-trigger"
        aria-label={`Conta de ${shop.name || "Meu pet shop"}`}
        aria-expanded={open}
        aria-controls="business-account-panel"
        onClick={() => setOpen(!open)}
      >
        {shop.logo_url && failedImage !== shop.logo_url ? (
          <img
            src={shop.logo_url}
            alt=""
            onError={() => setFailedImage(shop.logo_url || null)}
          />
        ) : (
          <span className="account-avatar">
            {shop.name?.trim().slice(0, 2).toUpperCase() || "P"}
          </span>
        )}
        <span className="account-name">
          <strong>{shop.name || "Meu pet shop"}</strong>
          <small>{access === "account" ? "Sua conta" : "Seu negócio"}</small>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          id="business-account-panel"
          className="account-dropdown"
          onClick={() => setOpen(false)}
        >
          <Link to="/painel/dashboard">Abrir painel</Link>
          {access === "owner" && <><Link to="/painel/dashboard?aba=info">Dados e foto do negócio</Link><Link to="/painel/dashboard?aba=subscription">Assinatura</Link></>}
          {access === "account" && <Link to="/minhas-reservas">Minhas reservas</Link>}
          <Link to="/">Ver site público</Link>
          <Link to="/faq">Ajuda</Link>
          <button type="button" onClick={() => void signOut()}>
            Sair da conta
          </button>
        </div>
      )}
    </div>
  );
  return inHeader && headerTarget ? createPortal(content, headerTarget) : content;
}
