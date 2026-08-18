import { Link } from 'react-router-dom'
import { BrandAccent } from '../../components/BrandAccent'

export function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-brass mb-2">ONEFIND</p>
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Página não encontrada</h1>
      <BrandAccent className="mx-auto mt-4 max-w-xs" />
      <p className="mt-4 text-ink-muted">
        O endereço que você abriu não existe ou foi movido. Volte ao início para continuar.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary px-5 py-2.5">
          Ir para o início
        </Link>
        <Link
          to="/painel"
          className="rounded-lg border border-paper-dark px-5 py-2.5 text-sm text-ink-muted hover:text-ink"
        >
          Entrar no painel
        </Link>
      </div>
    </div>
  )
}
