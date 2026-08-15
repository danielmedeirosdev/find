import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PUBLIC_SITE_ORIGIN } from '../../lib/site'
import { SUBSCRIPTION_PRICE } from '../../lib/types'
import { formatPrice } from '../../lib/format'

const CONTACT_EMAIL = 'daniellindomaravijoso@gmail.com'
const PRICE_LABEL = `${formatPrice(SUBSCRIPTION_PRICE)} por mês`
const SITE_HOST = PUBLIC_SITE_ORIGIN.replace(/^https?:\/\//, '')

type FaqItem = {
  q: string
  text: string
  a: ReactNode
}

type FaqGroup = {
  title: string
  items: FaqItem[]
}

const GROUPS: FaqGroup[] = [
  {
    title: 'Sobre o ONEFIND',
    items: [
      {
        q: 'O que é o ONEFIND?',
        text: `ONEFIND é a plataforma de agendamento online e gestão para barbearias e pet shops, em ${SITE_HOST}. Clientes marcam horário pelo site. Profissionais gerenciam agenda, clientes, serviços e o negócio em um só painel.`,
        a: (
          <p>
            O ONEFIND é a plataforma de agendamento online e gestão para barbearias e pet shops, em{' '}
            <a href={PUBLIC_SITE_ORIGIN} className="text-brass underline-offset-2 hover:underline">
              {SITE_HOST}
            </a>
            . Clientes marcam horário pelo site. Profissionais gerenciam agenda, clientes, serviços
            e o negócio em um só painel.
          </p>
        ),
      },
      {
        q: 'Qual a diferença entre FIND BARBEARIA e FIND PET?',
        text: 'São duas soluções na mesma plataforma. FIND BARBEARIA é para cortes, barba e visual. FIND PET é para banho, tosa e cuidados com o pet, com cadastro de tutores, pets e porte. Cada módulo tem o fluxo certo para o tipo de negócio.',
        a: (
          <p>
            São duas soluções na mesma plataforma.{' '}
            <Link to="/barbearia" className="text-brass underline-offset-2 hover:underline">
              FIND BARBEARIA
            </Link>{' '}
            é para cortes, barba e visual.{' '}
            <Link to="/pet" className="text-brass underline-offset-2 hover:underline">
              FIND PET
            </Link>{' '}
            é para banho, tosa e cuidados com o pet, com cadastro de tutores, pets e porte. Cada
            módulo tem o fluxo certo para o tipo de negócio.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Para clientes',
    items: [
      {
        q: 'Como marco um horário?',
        text: 'Na página inicial escolha FIND BARBEARIA ou FIND PET, abra o estabelecimento, selecione serviço, profissional e um horário livre. Informe nome e WhatsApp para confirmar. O horário fica reservado na hora.',
        a: (
          <p>
            Na{' '}
            <Link to="/" className="text-brass underline-offset-2 hover:underline">
              página inicial
            </Link>{' '}
            escolha FIND BARBEARIA ou FIND PET, abra o estabelecimento, selecione serviço,
            profissional e um horário livre. Informe nome e WhatsApp para confirmar. O horário fica
            reservado na hora.
          </p>
        ),
      },
      {
        q: 'Preciso criar uma conta para agendar?',
        text: 'Não. Basta nome e WhatsApp. Se quiser, crie uma conta ou entre com Google para acompanhar tudo em Minhas Reservas.',
        a: (
          <p>
            Não. Basta nome e WhatsApp. Se quiser,{' '}
            <Link to="/entrar" className="text-brass underline-offset-2 hover:underline">
              crie uma conta
            </Link>{' '}
            ou entre com Google para acompanhar tudo em Minhas Reservas.
          </p>
        ),
      },
      {
        q: 'Como acesso minhas reservas?',
        text: 'Entre em Minhas Reservas com e-mail, WhatsApp ou Google. Agendamentos feitos sem conta também podem ser recuperados pelo WhatsApp usado na reserva.',
        a: (
          <p>
            Entre em{' '}
            <Link to="/minhas-reservas" className="text-brass underline-offset-2 hover:underline">
              Minhas Reservas
            </Link>{' '}
            com e-mail, WhatsApp ou Google. Agendamentos feitos sem conta também podem ser
            recuperados pelo WhatsApp usado na reserva.
          </p>
        ),
      },
      {
        q: 'Posso entrar com Google?',
        text: 'Sim. Clientes e profissionais podem entrar com Google, além de e-mail e senha.',
        a: (
          <p>
            Sim. Clientes e profissionais podem entrar com Google, além de e-mail e senha.
          </p>
        ),
      },
      {
        q: 'Como funciona o FIND PET?',
        text: 'No FIND PET o agendamento é para o pet. Informe o WhatsApp para localizar tutores e pets já cadastrados, escolha o serviço e o horário. O porte do animal entra no cadastro para o pet shop preparar o atendimento.',
        a: (
          <p>
            No FIND PET o agendamento é para o pet. Informe o WhatsApp para localizar tutores e
            pets já cadastrados, escolha o serviço e o horário. O porte do animal entra no cadastro
            para o pet shop preparar o atendimento.
          </p>
        ),
      },
      {
        q: 'Como deixo uma avaliação?',
        text: 'Depois do atendimento concluído, o estabelecimento pode enviar um link para você avaliar o serviço. A nota aparece na página pública do negócio.',
        a: (
          <p>
            Depois do atendimento concluído, o estabelecimento pode enviar um link para você
            avaliar o serviço. A nota aparece na página pública do negócio.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Para profissionais',
    items: [
      {
        q: 'Como começo a usar o painel?',
        text: 'Abra a área profissional, crie o estabelecimento (barbearia ou pet shop) e complete o cadastro. Você ganha 30 dias de teste grátis, sem cartão de crédito.',
        a: (
          <p>
            Abra a{' '}
            <Link to="/painel?modo=cadastro" className="text-brass underline-offset-2 hover:underline">
              área profissional
            </Link>
            , crie o estabelecimento (barbearia ou pet shop) e complete o cadastro. Você ganha 30
            dias de teste grátis, sem cartão de crédito.
          </p>
        ),
      },
      {
        q: 'O teste grátis pede cartão?',
        text: 'Não. São 30 dias para configurar serviços, equipe, horários e receber agendamentos. O cartão ou o Pix só entram se você assinar depois do teste.',
        a: (
          <p>
            Não. São 30 dias para configurar serviços, equipe, horários e receber agendamentos. O
            cartão ou o Pix só entram se você assinar depois do teste.
          </p>
        ),
      },
      {
        q: 'Quanto custa depois do teste?',
        text: `A assinatura custa ${PRICE_LABEL}, por estabelecimento.`,
        a: (
          <p>
            A assinatura custa <span className="text-ink">{PRICE_LABEL}</span>, por estabelecimento.
          </p>
        ),
      },
      {
        q: 'Como pago a assinatura?',
        text: 'No painel, em Assinatura, escolha Pix ou cartão. O pagamento é processado pelo Asaas. Não armazenamos o número completo do cartão na plataforma.',
        a: (
          <p>
            No painel, em Assinatura, escolha Pix ou cartão. O pagamento é processado pelo Asaas.
            Não armazenamos o número completo do cartão na plataforma.
          </p>
        ),
      },
      {
        q: 'O que acontece quando o teste acaba?',
        text: 'Sem assinatura ativa o painel fica bloqueado até a regularização. Os dados do estabelecimento permanecem. Depois de assinar, o acesso volta ao normal.',
        a: (
          <p>
            Sem assinatura ativa o painel fica bloqueado até a regularização. Os dados do
            estabelecimento permanecem. Depois de assinar, o acesso volta ao normal.
          </p>
        ),
      },
      {
        q: 'Como os clientes encontram meu negócio?',
        text: 'O estabelecimento aparece na lista pública de FIND BARBEARIA ou FIND PET. Você também pode compartilhar o link da página pública (endereço curto /b/seu-nome) e o WhatsApp do negócio.',
        a: (
          <p>
            O estabelecimento aparece na lista pública de FIND BARBEARIA ou FIND PET. Você também
            pode compartilhar o link da página pública (endereço curto <span className="text-ink">/b/seu-nome</span>) e o
            WhatsApp do negócio.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Privacidade e contato',
    items: [
      {
        q: 'Como o ONEFIND trata meus dados?',
        text: 'Coletamos só o necessário para conta, agendamento e gestão do negócio, em conformidade com a LGPD. Detalhes estão na Política de Privacidade.',
        a: (
          <p>
            Coletamos só o necessário para conta, agendamento e gestão do negócio, em conformidade
            com a LGPD. Detalhes estão na{' '}
            <Link to="/privacidade" className="text-brass underline-offset-2 hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        ),
      },
      {
        q: 'Como falo com o suporte?',
        text: `Escreva para ${CONTACT_EMAIL}. Respondemos dúvidas de clientes e de profissionais.`,
        a: (
          <p>
            Escreva para{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-brass underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . Respondemos dúvidas de clientes e de profissionais.
          </p>
        ),
      },
    ],
  },
]

export function Faq() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Perguntas frequentes · ONEFIND'

    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <article className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-brass font-medium">Ajuda</p>
      <h1 className="mt-3 font-display text-4xl tracking-wide text-ink sm:text-5xl">
        Perguntas frequentes
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        Respostas objetivas sobre agendamento, painel profissional e a plataforma ONEFIND.
      </p>

      <div className="mt-10 space-y-10">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="font-display text-xl tracking-wide text-ink">{group.title}</h2>
            <div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
              {group.items.map((item) => (
                <details key={item.q} className="faq-item group">
                  <summary className="faq-summary">
                    <span>{item.q}</span>
                  </summary>
                  <div className="pb-4 pr-8 text-[15px] leading-relaxed text-ink-muted">{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-ink-muted">
        <Link to="/" className="text-brass underline-offset-2 hover:underline">
          Voltar ao início
        </Link>
        {' · '}
        <Link to="/privacidade" className="text-brass underline-offset-2 hover:underline">
          Política de Privacidade
        </Link>
      </p>
    </article>
  )
}
