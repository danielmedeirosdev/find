import type { ReactNode } from 'react'
import { SegmentProvider } from '../../../contexts/SegmentContext'
import { BrandAccent } from '../../../components/BrandAccent'
import type { Shop, ShopSegment } from '../../../lib/types'
import { getSegment } from '../../../lib/segments'

export interface ProfessionalTab {
  id: string
  label: string
}

interface Props {
  shop: Shop
  segment: ShopSegment
  tabs: ProfessionalTab[]
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
  activeTab,
  onTabChange,
  title,
  subtitle,
  children,
}: Props) {
  const meta = getSegment(segment)

  return (
    <SegmentProvider segment={segment}>
      <div className={meta.themeClass} data-segment={segment} data-professional={segment}>
        <div className="mb-8 flex items-center gap-4">
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt=""
              className="h-14 w-14 rounded-xl object-cover border border-charcoal-light"
            />
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-widest text-brass/80 mb-1">
              {meta.panelEyebrow}
            </p>
            <h1 className="font-display text-4xl text-brass">{title}</h1>
            <p className="text-charcoal-muted text-sm mt-1">
              {subtitle || meta.panelSubtitle}
            </p>
          </div>
        </div>

        <BrandAccent className="mb-6 max-w-sm" height="h-1" segment={segment} />

        <nav
          className="mb-8 flex flex-wrap gap-2 border-b border-charcoal-light pb-4"
          aria-label={`Navegação ${meta.brandName}`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-brass text-charcoal'
                  : 'text-charcoal-muted hover:text-white hover:bg-charcoal-light'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {children}
      </div>
    </SegmentProvider>
  )
}
