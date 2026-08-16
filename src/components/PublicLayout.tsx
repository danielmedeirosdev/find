import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SegmentProvider } from '../contexts/SegmentContext'
import { BrandAccent } from './BrandAccent'
import { SetupBanner } from './SetupBanner'
import { getSegmentFromPath } from '../lib/segments'

export function PublicLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const isShopList = pathname === '/barbearia' || pathname === '/pet'
  const segmentMeta = getSegmentFromPath(pathname)
  const segmentId =
    segmentMeta?.id ||
    (pathname.startsWith('/b/') ||
    pathname === '/' ||
    pathname.startsWith('/entrar') ||
    pathname.startsWith('/cadastro') ||
    pathname.startsWith('/minhas-reservas') ||
    pathname.startsWith('/confirmacao') ||
    pathname.startsWith('/avaliar') ||
    pathname.startsWith('/privacidade') ||
    pathname.startsWith('/faq')
      ? 'platform'
      : 'barbershop')
  const isPet = segmentId === 'pet'

  const content = (
    <div className={`public-shell min-h-screen text-ink ${isPet ? 'bg-paper' : ''}`}>
      <SetupBanner />
      <header className="sticky top-0 z-30 border-b border-paper-dark/80 bg-paper/90 backdrop-blur-md">
        <div
          className={`mx-auto flex items-center justify-between gap-3 px-4 py-3.5 ${
            isShopList ? 'max-w-6xl' : 'max-w-5xl'
          }`}
        >
          <Link to="/" className="min-w-0">
            <span className="font-display text-3xl tracking-[0.12em] text-ink">ONEFIND</span>
            {segmentMeta && (
              <span className="ml-2 hidden align-middle text-[11px] font-semibold uppercase tracking-[0.22em] text-brass sm:inline">
                {segmentMeta.shortName}
              </span>
            )}
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
            {!isHome && (
              <Link to="/" className="hidden text-ink-muted transition-colors hover:text-brass sm:inline">
                Início
              </Link>
            )}
            {segmentMeta && !isShopList && (
              <Link
                to={segmentMeta.path}
                className="hidden text-ink-muted transition-colors hover:text-brass sm:inline"
              >
                {isPet ? 'Pet shops' : 'Barbearias'}
              </Link>
            )}
            {user ? (
              <Link
                to="/minhas-reservas"
                className="text-ink-muted transition-colors hover:text-brass"
              >
                Minhas reservas
              </Link>
            ) : (
              <Link to="/entrar" className="text-ink-muted transition-colors hover:text-brass">
                Entrar
              </Link>
            )}
            <Link
              to={
                segmentMeta
                  ? `/painel?segment=${segmentMeta.id}&modo=cadastro`
                  : '/painel?modo=cadastro'
              }
              className="rounded-md border border-ink/15 px-3 py-1.5 text-ink-muted transition-colors hover:border-brass hover:text-brass"
            >
              Para empresas
            </Link>
          </nav>
        </div>
        <BrandAccent height="h-1" segment={segmentId} />
      </header>
      <main
        className={`mx-auto px-4 py-8 ${
          isHome ? 'max-w-4xl' : isShopList ? 'max-w-6xl' : 'max-w-5xl'
        }`}
      >
        <Outlet />
      </main>
      {!isHome && (
        <footer className="mt-16 border-t border-paper-dark/80 py-8 text-center text-sm text-ink-muted">
          <p className="font-display text-lg tracking-[0.18em] text-ink">ONEFIND</p>
          <p className="mx-auto mt-2 max-w-md">
            {isPet
              ? 'Agendamento online para banho, tosa e cuidados.'
              : segmentMeta
                ? 'Agendamento online para barbearias, sem fila e sem aplicativo.'
                : 'Agendamento online para barbearias e pet shops.'}
          </p>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link to="/faq" className="transition-colors hover:text-brass">
              Perguntas frequentes
            </Link>
            <Link to="/privacidade" className="transition-colors hover:text-brass">
              Privacidade
            </Link>
          </p>
        </footer>
      )}
    </div>
  )

  if (segmentMeta) {
    return <SegmentProvider segment={segmentMeta.id}>{content}</SegmentProvider>
  }
  return content
}
