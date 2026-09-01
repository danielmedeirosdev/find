import type { ReactNode, SVGProps } from 'react'

export type AppIconName =
  | 'agenda'
  | 'arrow-left'
  | 'arrow-right'
  | 'bell'
  | 'briefcase'
  | 'car'
  | 'chart'
  | 'check'
  | 'clock'
  | 'heart'
  | 'home'
  | 'link'
  | 'megaphone'
  | 'package'
  | 'paw'
  | 'receipt'
  | 'refresh'
  | 'search'
  | 'scissors'
  | 'settings'
  | 'shield'
  | 'sparkles'
  | 'star'
  | 'stethoscope'
  | 'store'
  | 'tag'
  | 'users'
  | 'wallet'

interface Props extends SVGProps<SVGSVGElement> {
  name: AppIconName
  size?: number
}

const paths: Record<AppIconName, ReactNode> = {
  agenda: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
  'arrow-left': <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
  'arrow-right': <><path d="m9 18 6-6-6-6" /><path d="M4 12h11" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  car: <><path d="m5 17-2-1v-4l2-1 2-4h10l2 4 2 1v4l-2 1" /><path d="M5 17h14M7 17v2M17 17v2M7 13h.01M17 13h.01" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-7h6v7" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></>,
  megaphone: <><path d="m3 11 15-6v14L3 13z" /><path d="M11 16v3a2 2 0 0 1-4 0v-4" /><path d="M21 9v6" /></>,
  package: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 8 9 5 9-5v10l-9 5-9-5zM12 13v10" /></>,
  paw: <><circle cx="7" cy="8" r="2" /><circle cx="12" cy="5" r="2" /><circle cx="17" cy="8" r="2" /><path d="M7.5 17.5c0-3 2-5.5 4.5-5.5s4.5 2.5 4.5 5.5c0 2-1.3 3.5-3 3.5-.7 0-1-.5-1.5-.5s-.8.5-1.5.5c-1.7 0-3-1.5-3-3.5Z" /></>,
  receipt: <><path d="M5 3v18l3-2 4 2 4-2 3 2V3l-3 2-4-2-4 2z" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
  refresh: <><path d="M20 7h-5V2" /><path d="M20 7a9 9 0 1 0 1 8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  scissors: <><circle cx="6" cy="7" r="3" /><circle cx="6" cy="17" r="3" /><path d="m8.5 8.5 12 11M8.5 15.5l12-11" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></>,
  sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 14l.6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6z" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />,
  stethoscope: <><path d="M5 3v5a5 5 0 0 0 10 0V3M3 3h4M13 3h4" /><path d="M10 13v2a5 5 0 0 0 10 0v-1" /><circle cx="20" cy="11" r="2" /></>,
  store: <><path d="M3 9h18l-2-6H5zM5 9v12h14V9M9 21v-7h6v7" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
  tag: <><path d="M20 13 13 20l-9-9V4h7z" /><circle cx="8" cy="8" r="1" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14" /><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5" /></>,
}

export function AppIcon({ name, size = 20, className = '', ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
