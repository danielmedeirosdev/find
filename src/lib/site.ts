/** Domínio público canônico do FIND (links para clientes copiarem). */
export const PUBLIC_SITE_ORIGIN = (
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ||
  'https://www.onefind.com.br'
).replace(/\/$/, '')

export function publicSiteHost(): string {
  try {
    return new URL(PUBLIC_SITE_ORIGIN).host
  } catch {
    return 'www.onefind.com.br'
  }
}

export function absolutePublicUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${PUBLIC_SITE_ORIGIN}${normalized}`
}
