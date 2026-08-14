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
    <div className={`min-h-screen text-ink ${isPet ? 'bg-paper' : 'bg-paper'}`}>
      <SetupBanner />
      <header className="border-b border-paper-dark bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="font-display text-3xl tracking-wider text-ink">
              {isHome ? 'ONEFIND' : 'FIND'}
            </Link>
            {segmentMeta && (
              <span className="text-xs uppercase tracking-widest text-brass font-medium">
                {segmentMeta.shortName}
              </span>
            )}
          </div>
          <nav className="flex items-center gap-4 text-sm">
            {!isHome && (
              <Link to="/" className="text-ink-muted hover:text-brass transition-colors">
                Início
              </Link>
            )}
            {segmentMeta && (
              <Link
                to={segmentMeta.path}
                className="hidden text-ink-muted hover:text-brass transition-colors sm:inline"
              >
                {isPet ? 'Pet shops' : 'Barbearias'}
              </Link>
            )}
            {user ? (
              <Link
                to="/minhas-reservas"
                className="text-ink-muted hover:text-brass transition-colors"
              >
                Minhas Reservas
              </Link>
            ) : (
              <Link to="/entrar" className="text-ink-muted hover:text-brass transition-colors">
                Entrar
              </Link>
            )}
            <Link
              to={
                segmentMeta
                  ? `/painel?segment=${segmentMeta.id}&modo=cadastro`
                  : '/painel'
              }
              className="rounded border border-ink/20 px-3 py-1.5 text-ink-muted hover:border-brass hover:text-brass transition-colors"
            >
              Área profissional
            </Link>
          </nav>
        </div>
        <BrandAccent height="h-1.5" segment={segmentId} />
      </header>
      <main
        className={`mx-auto px-4 py-8 ${
          isHome ? 'max-w-4xl' : isShopList ? 'max-w-6xl' : 'max-w-5xl'
        }`}
      >
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-paper-dark py-6 text-center text-sm text-ink-muted">
        <BrandAccent className="mb-4 max-w-xs mx-auto" segment={segmentId} />
        <p>
          {isPet
            ? 'FIND PET · banho, tosa e cuidados com profissionalismo'
            : segmentMeta
              ? 'FIND BARBEARIA · agende com estilo'
              : 'ONEFIND · uma plataforma, várias soluções'}
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to="/faq" className="hover:text-brass transition-colors">
            Perguntas frequentes
          </Link>
          <Link to="/privacidade" className="hover:text-brass transition-colors">
            Política de Privacidade
          </Link>
          {isHome && (
            <Link to="/apresentacao" className="hover:text-brass transition-colors">
              Conhecer a plataforma
            </Link>
          )}
        </p>
      </footer>
    </div>
  )

  if (segmentMeta) {
    return <SegmentProvider segment={segmentMeta.id}>{content}</SegmentProvider>
  }
  return content
}
