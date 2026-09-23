import { BusinessAccount } from '../../../components/BusinessAccount'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { SegmentProvider } from '../../../contexts/SegmentContext'
import { BrandAccent } from '../../../components/BrandAccent'
import type { Shop, ShopSegment } from '../../../lib/types'
import { getSegment } from '../../../lib/segments'
import { AppIcon, type AppIconName } from '../../../components/AppIcon'
import { UpdatesButton } from '../../../components/UpdatesButton'

export interface ProfessionalTab {
  id: string
  label: string
  icon?: AppIconName
}

export interface ProfessionalTabGroup {
  label: string
  tabs: ProfessionalTab[]
}

interface Props {
  shop: Shop
  segment: ShopSegment
  tabs: ProfessionalTab[]
  tabGroups?: ProfessionalTabGroup[]
  activeTab: string
  onTabChange: (tab: string) => void
  /** Título principal do painel (ex.: nome da loja ou "Meu Pet Shop") */
  title: string
  subtitle?: string
  children: ReactNode
}

/**
 * Chrome compartilhado do painel profissional.
 * A navegação e o conteúdo vêm de ProfessionalBarbearia / ProfessionalPet.
 */
export function ProfessionalShell({
  shop,
  segment,
  tabs,
  tabGroups,
  activeTab,
  onTabChange,
  title,
  subtitle,
  children,
}: Props) {
  const meta = getSegment(segment)
  const location = useLocation()
  const contentRef = useRef<HTMLDivElement>(null)
  const previousTab = useRef(activeTab)
  useLayoutEffect(() => {
    const explicitDestination = new URLSearchParams(location.search).has('aba')
    const changed = previousTab.current !== activeTab
    previousTab.current = activeTab
    if (!explicitDestination && !changed) return
    const frame = requestAnimationFrame(() => {
      const content = contentRef.current
      if (!content) return
      const headerHeight = document.querySelector('.dashboard-glass-header')?.getBoundingClientRect().height || 80
      content.focus({ preventScroll: true })
      window.scrollTo({ top: window.scrollY + content.getBoundingClientRect().top - headerHeight - 20, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeTab, location.key, location.search])

  return (
    <SegmentProvider segment={segment}>
      <div className={meta.themeClass} data-segment={segment} data-professional={segment}>
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt=""
              className="h-14 w-14 rounded-xl object-cover border border-charcoal-light"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-brass/80 mb-1">
              {meta.panelEyebrow}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl text-brass break-words">{title}</h1>
            <p className="text-charcoal-muted text-sm mt-1">
              {subtitle || meta.panelSubtitle}
            </p>
          </div>
          <UpdatesButton className="sm:ml-auto" />
          <BusinessAccount shop={shop} />
        </div>

        <BrandAccent className="mb-6 max-w-sm" height="h-1" segment={segment} />

        {tabGroups && tabGroups.length > 0 ? (
          <nav className="mb-8 space-y-4 border-b border-charcoal-light pb-4" aria-label={`Navegação ${meta.brandName}`}>
            {tabGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-charcoal-muted/80">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2 pb-1">
                  {group.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      aria-current={activeTab === tab.id ? 'page' : undefined}
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-[background-color,color,transform,box-shadow] ${
                        activeTab === tab.id
                          ? 'bg-brass text-charcoal shadow-[0_8px_22px_rgba(0,0,0,0.18)]'
                          : 'text-charcoal-muted hover:-translate-y-0.5 hover:bg-charcoal-light hover:text-white'
                      }`}
                    >
                      {tab.icon ? <AppIcon name={tab.icon} size={17} /> : null}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        ) : (
          <nav
            className="mb-8 flex gap-2 overflow-x-auto border-b border-charcoal-light pb-4 -mx-1 px-1"
            aria-label={`Navegação ${meta.brandName}`}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-[background-color,color,transform,box-shadow] ${
                  activeTab === tab.id
                    ? 'bg-brass text-charcoal shadow-[0_8px_22px_rgba(0,0,0,0.18)]'
                    : 'text-charcoal-muted hover:-translate-y-0.5 hover:bg-charcoal-light hover:text-white'
                }`}
              >
                {tab.icon ? <AppIcon name={tab.icon} size={17} /> : null}
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        <div key={activeTab} ref={contentRef} tabIndex={-1} role="region" aria-label={tabs.find(tab => tab.id === activeTab)?.label || title} className="dashboard-tab-content">
          <div className="panel-enter">{children}</div>
        </div>
      </div>
    </SegmentProvider>
  )
}
