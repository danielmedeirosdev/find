import { Modal } from '../../../components/Modal'
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BusinessAccount } from "../../../components/BusinessAccount";
import { SegmentProvider } from "../../../contexts/SegmentContext";
import type { Shop, ShopSegment } from "../../../lib/types";
import { getSegment } from "../../../lib/segments";
import { AppIcon, type AppIconName } from "../../../components/AppIcon";
export interface ProfessionalTab {
  id: string;
  label: string;
  icon?: AppIconName;
}
export interface ProfessionalTabGroup {
  label: string;
  tabs: ProfessionalTab[];
}
interface Props {
  shop: Shop;
  segment: ShopSegment;
  tabs: ProfessionalTab[];
  tabGroups?: ProfessionalTabGroup[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}
export function ProfessionalShell({
  shop,
  segment,
  tabs,
  tabGroups,
  activeTab,
  onTabChange,
  title,
  children,
}: Props) {
  const [menu, setMenu] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const previous = useRef(activeTab);
  useEffect(() => {
    if (previous.current !== activeTab) {
      content.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
      previous.current = activeTab;
    }
  }, [activeTab]);
  const go = (id: string) => {
    onTabChange(id);
    setMenu(false);
  };
  const groups = tabGroups?.length ? tabGroups : [{ label: "Painel", tabs }];
  const primary = ["overview", "agenda", "customers", "cashflow"]
    .map((id) => tabs.find((t) => t.id === id))
    .filter((t): t is ProfessionalTab => !!t);
  const nav = (
    <>
      {groups.map((group) => (
        <section key={group.label}>
          <p className="workspace-nav-label">{group.label}</p>
          <div className="workspace-nav-items">{group.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => go(tab.id)}
            >
              {tab.icon && <AppIcon name={tab.icon} size={18} />}
              <span>{tab.label}</span>
            </button>
          ))}</div>
        </section>
      ))}
    </>
  );
  return (
    <SegmentProvider segment={segment}>
      <div
        className={`workspace ${getSegment(segment).themeClass}`}
        data-segment={segment}
        data-professional={segment}
      >
        <BusinessAccount shop={shop} access={tabs.some(t=>t.id==='subscription')?'owner':'staff'} />
        <aside className="workspace-sidebar">
          <div className="workspace-shop">
            {shop.logo_url && <img src={shop.logo_url} alt="" />}
            <div>
              <span>ESTABELECIMENTO</span>
              <h1>{title}</h1>
            </div>
          </div>
          <nav aria-label="Áreas do painel">{nav}</nav>
        </aside>
        <div className="workspace-main">
          <div className="workspace-location">
            <span>{title}</span>
            <span>{tabs.find((t) => t.id === activeTab)?.label}</span>
          </div>
          <div
            key={activeTab}
            ref={content}
            tabIndex={-1}
            role="region"
            aria-label={tabs.find((t) => t.id === activeTab)?.label || title}
            className="dashboard-tab-content"
          >
            {children}
          </div>
        </div>
        {menu && (
          <Modal label="Todas as áreas" onClose={() => setMenu(false)} className="workspace-menu-layer">
          <div className="workspace-menu">
            <header>
              <strong>Áreas do onefind</strong>
              <button type="button" onClick={() => setMenu(false)}>
                Fechar
              </button>
            </header>
            <nav aria-label="Todas as áreas do painel">{nav}</nav>
          </div>
          </Modal>
        )}
        <nav className="workspace-bottom" aria-label="Acesso rápido">
          {primary.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={activeTab === t.id ? "page" : undefined}
              onClick={() => go(t.id)}
            >
              {t.icon && <AppIcon name={t.icon} size={20} />}
              <span>{t.id === "overview" ? "Início" : t.label}</span>
            </button>
          ))}
          <button
            type="button"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <AppIcon name="store" size={20} />
            <span>Mais</span>
          </button>
        </nav>
      </div>
    </SegmentProvider>
  );
}
