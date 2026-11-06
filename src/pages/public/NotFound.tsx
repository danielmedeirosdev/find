import { Link } from 'react-router-dom'
import { StoryHeader, StoryFooter } from '../../components/marketing/StoryShell'

export function NotFound() {
  return (
    <div className="mkt-site">
      <StoryHeader />
      <main className="mkt-container flex min-h-[75svh] flex-col items-center justify-center py-36 text-center">
      <p className="mb-5 text-sm tracking-[0.2em] text-brass">ERRO 404</p>
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Página não encontrada</h1>
      <p className="mt-5 max-w-md text-base text-charcoal-muted sm:text-lg">Este endereço não está disponível. Volte ao início ou acesse seu painel para continuar.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="rounded-xl bg-brass px-5 py-3 font-semibold text-charcoal">
          Ir para o início
        </Link>
        <Link
          to="/painel"
          className="rounded-xl border border-charcoal-light px-5 py-3 text-white hover:border-brass"
        >
          Entrar no painel
        </Link>
      </div>
      </main>
      <StoryFooter />
    </div>
  )
}
