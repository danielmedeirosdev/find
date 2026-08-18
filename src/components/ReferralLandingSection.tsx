import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CtaArrow } from './SegmentMark'

type Variant = 'platform' | 'barbershop' | 'pet'

const COPY: Record<
  Variant,
  { eyebrow: string; title: string; lead: string; example: string; ctaLogged: string }
> = {
  platform: {
    eyebrow: 'Indique e ganhe',
    title: 'Indique o ONEFIND. Ganhe enquanto ajuda outra empresa a crescer.',
    lead: 'Você já usa o ONEFIND. Agora pode indicar para outros negócios e ganhar benefícios por cada nova empresa que se tornar cliente.',
    example: '1 indicação convertida = 1 mês grátis. 3 indicações = 3 meses grátis.',
    ctaLogged: 'Abrir Indique e ganhe',
  },
  barbershop: {
    eyebrow: 'Indique e ganhe',
    title: 'Indique o ONEFIND para outra barbearia.',
    lead: 'Seu barbeiro parceiro também merece uma agenda organizada. Quando ele assinar, você ganha meses grátis.',
    example: 'Compartilhe com outra barbearia. Cada assinatura confirmada vale 1 mês grátis.',
    ctaLogged: 'Ver meu link de indicação',
  },
  pet: {
    eyebrow: 'Indique e ganhe',
    title: 'Indique o ONEFIND para outro negócio pet.',
    lead: 'Ajude outros negócios pet a organizar seus atendimentos e ganhar tempo. Quando a empresa assinar, você recebe a recompensa.',
    example: 'Compartilhe com outro pet shop. Cada assinatura confirmada vale 1 mês grátis.',
    ctaLogged: 'Ver meu link de indicação',
  },
}

const STEPS = [
  { n: '1', title: 'Compartilhe', text: 'Envie seu link exclusivo.' },
  { n: '2', title: 'Seu indicado testa', text: 'A empresa cria a conta e experimenta o ONEFIND.' },
  { n: '3', title: 'A empresa assina', text: 'Quando a assinatura for confirmada, sua indicação é convertida.' },
  { n: '4', title: 'Você ganha', text: 'Receba meses gratuitos de acordo com suas indicações.' },
]

interface Props {
  variant?: Variant
  className?: string
}

export function ReferralLandingSection({ variant = 'platform', className = '' }: Props) {
  const { user } = useAuth()
  const copy = COPY[variant]
  const href = user ? '/painel/dashboard?aba=referral' : '/painel'

  return (
    <section className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brass">{copy.eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">{copy.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">{copy.lead}</p>
      <p className="mt-2 text-sm text-ink">{copy.example}</p>

      <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <li key={step.n} className="rounded-xl border border-ink/10 bg-white/80 px-4 py-4 text-left">
            <p className="font-display text-2xl text-brass">{step.n}</p>
            <p className="mt-2 font-semibold text-ink">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.text}</p>
          </li>
        ))}
      </ol>

      <Link to={href} className="btn-primary mt-8 inline-flex items-center justify-center">
        {user ? copy.ctaLogged : 'Quero indicar o ONEFIND'}
        <CtaArrow />
      </Link>
    </section>
  )
}
