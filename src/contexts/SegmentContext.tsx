import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { getSegment, type SegmentDefinition } from '../lib/segments'
import type { ShopSegment } from '../lib/types'

const SegmentContext = createContext<SegmentDefinition>(getSegment('barbershop'))

export function SegmentProvider({
  segment,
  children,
}: {
  segment: ShopSegment | string | null | undefined
  children: ReactNode
}) {
  const value = useMemo(() => getSegment(segment), [segment])

  // Tema só no wrapper local — não polui <html>, para a barbearia
  // manter dourado clássico mesmo após visitar rotas PET.
  return (
    <SegmentContext.Provider value={value}>
      <div className={value.themeClass} data-segment={value.id}>
        {children}
      </div>
    </SegmentContext.Provider>
  )
}

export function useSegment(): SegmentDefinition {
  return useContext(SegmentContext)
}
