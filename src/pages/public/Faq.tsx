import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MarketingHeader } from '../../components/MarketingHeader'
import { BrandLogo } from '../../components/BrandLogo'
import { SUBSCRIPTION_PRICE } from '../../lib/types'
import { formatPrice } from '../../lib/format'

const GROUPS = [
  { title: 'Primeiros passos', items: [
    ['O que é o onefind?', 'Uma plataforma de gestão para pet shops e banho e tosa. Reúne clientes, pets, serviços, equipe, atendimentos e financeiro em um só lugar.'],
    ['Como começo?', 'Crie sua conta e cadastre seu estabelecimento. Depois, escolha configurar sozinho pelo passo a passo ou receber ajuda humana pelo WhatsApp.'],
    ['O que significa “Comece em 1 minuto”?', 'É o convite para dar o primeiro passo e iniciar seu cadastro. A configuração completa depende das informações do seu negócio, como serviços, equipe e horários.'],
    ['Preciso cadastrar um cartão para testar?', 'Não. Você tem 30 dias grátis para conhecer a plataforma, sem cadastrar cartão para começar.'],
  ]},
  { title: 'Configuração e rotina', items: [
    ['Como funciona a configuração assistida?', 'Na configuração inicial, escolha “Configuração com assistente”. Você poderá editar a mensagem e abrir uma conversa no WhatsApp para receber orientação humana. A conclusão depende das informações do negócio e da disponibilidade do atendimento.'],
    ['Posso configurar por conta própria?', 'Sim. O passo a passo permite informar os dados do estabelecimento, cadastrar serviços e equipe e definir os horários. As informações podem ser ajustadas depois no painel.'],
    ['Quem define a duração e os horários dos atendimentos?', 'O estabelecimento define os serviços, a duração e a disponibilidade. Se o atendimento depende de avaliação do pet ou de um encaixe, combine os detalhes com o tutor antes de registrar ou confirmar o atendimento.'],
    ['O onefind responde mensagens do WhatsApp automaticamente?', 'Não. O atendimento pelo WhatsApp continua sendo feito por você ou pela sua equipe. O onefind centraliza as informações e a gestão dos atendimentos.'],
    ['Como divulgo meu estabelecimento?', 'No painel, acesse “Link público” e compartilhe o endereço da página do seu negócio no WhatsApp, Instagram e Google.'],
    ['Onde altero o nome e a foto do negócio?', 'Abra o menu da conta, no canto superior direito, e selecione “Dados e foto do negócio”. Você também pode acessar “Meu pet shop” no painel.'],
  ]},
  { title: 'Plano e assinatura', items: [
    ['Quanto custa depois do teste?', `A assinatura custa ${formatPrice(SUBSCRIPTION_PRICE)} por mês, por estabelecimento.`],
    ['Onde vejo minha assinatura?', 'No menu da conta, selecione “Assinatura”, ou acesse “Plano” no painel. Ali você consulta a situação da assinatura e as opções de pagamento.'],
    ['Quais são as formas de pagamento?', 'A área de assinatura oferece Pix e cartão, com pagamento processado pelo Asaas. Confira as opções e os dados antes de confirmar o pagamento.'],
    ['O que acontece quando o teste termina?', 'Para continuar utilizando o painel após o período grátis, é necessário ativar a assinatura. Consulte a situação do seu plano na área de assinatura.'],
  ]},
  { title: 'Para tutores', items: [
    ['Como solicito um atendimento para meu pet?', 'Abra o link compartilhado pelo estabelecimento e siga as opções apresentadas. Informe os dados solicitados do tutor e do pet. Para serviços que precisam de avaliação ou combinação de horário, fale diretamente com o pet shop.'],
    ['Como acompanho minhas reservas?', 'Acesse “Minhas reservas” com sua conta. Se não encontrar um atendimento, entre em contato com o estabelecimento para conferir os dados usados no cadastro.'],
    ['Posso entrar com Google?', 'Sim. A tela de acesso oferece Google, além de e-mail e senha.'],
    ['Como deixo uma avaliação?', 'Depois de concluir o atendimento, o estabelecimento pode compartilhar um link para você avaliar o serviço.'],
  ]},
]

export function Faq() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Ajuda e perguntas frequentes · onefind'
    window.scrollTo({ top: 0, behavior: 'instant' })
    return () => { document.title = previous }
  }, [])
  return <div className="premium-landing premium-faq">
    <MarketingHeader />
    <main className="faq-page">
      <header className="faq-intro"><p className="premium-eyebrow">Central de ajuda</p><h1>Como podemos<br /><span>te ajudar?</span></h1><p>Encontre respostas sobre o seu negócio, a configuração e o dia a dia no onefind.</p></header>
      <div className="faq-layout"><aside className="faq-support"><h2>Precisa de uma mão?</h2><p>Converse com a gente sobre a configuração ou o uso da plataforma.</p><a href="https://wa.me/5519974280798?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20onefind." target="_blank" rel="noopener noreferrer">Falar pelo WhatsApp ↗</a><span>(19) 97428-0798</span></aside>
      <div className="faq-groups">{GROUPS.map(group => <section key={group.title}><h2>{group.title}</h2><div className="faq-questions">{group.items.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>)}<section><h2>Privacidade</h2><div className="faq-questions"><details><summary>Onde consulto as informações sobre meus dados?<span aria-hidden="true">+</span></summary><p>Veja como os dados são tratados e quais são os canais de contato na <Link to="/privacidade">Política de Privacidade</Link>.</p></details></div></section></div></div>
    </main>
    <footer className="premium-footer"><Link to="/"><BrandLogo /></Link><p>Negócios que cuidam, sempre encontram.</p><nav aria-label="Rodapé"><Link to="/">Início</Link><Link to="/privacidade">Privacidade</Link><Link to="/minhas-reservas">Minhas reservas</Link></nav></footer>
  </div>
}
