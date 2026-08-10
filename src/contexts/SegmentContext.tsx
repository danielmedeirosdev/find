import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
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

  useEffect(() => {
    const root = document.documentElement
    const prev = root.getAttribute('data-segment')
    root.setAttribute('data-segment', value.id)
    root.classList.toggle('segment-pet', value.id === 'pet')
    root.classList.toggle('segment-barbershop', value.id === 'barbershop')
    return () => {
      if (prev) root.setAttribute('data-segment', prev)
      else root.removeAttribute('data-segment')
      root.classList.remove('segment-pet', 'segment-barbershop')
    }
  }, [value.id])

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
