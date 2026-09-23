import { createContext } from 'react'
/** The account belongs to the global header; the active screen supplies live shop data. */
export const DashboardHeaderContext = createContext<HTMLDivElement | null>(null)
