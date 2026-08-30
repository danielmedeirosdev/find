import { Link } from 'react-router-dom'
import { PUBLIC_SITE_ORIGIN } from '../../lib/site'

const LAST_UPDATED = '11 de agosto de 2026'
const CONTACT_EMAIL = 'danielmedeiros.web@gmail.com.br'

export function PrivacyPolicy() {
  return (
    <article className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-brass font-medium">Legal</p>
      <h1 className="mt-3 font-display text-4xl tracking-wide text-ink sm:text-5xl">
        Política de Privacidade
      </h1>
      <p className="mt-3 text-sm text-ink-muted">Última atualização: {LAST_UPDATED}</p>

      <div className="prose-privacy mt-10 space-y-8 text-[15px] leading-relaxed text-ink-muted">
        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">1. Quem somos</h2>
          <p className="mt-3">
            O FIND (“nós”, “plataforma”) é um serviço online de agendamento e gestão para negócios
            como barbearias e pet shops, disponível em{' '}
            <a href={PUBLIC_SITE_ORIGIN} className="text-brass underline-offset-2 hover:underline">
              {PUBLIC_SITE_ORIGIN.replace(/^https?:\/\//, '')}
            </a>
            . Esta Política descreve como tratamos dados pessoais de clientes finais e de
            profissionais que usam a plataforma, em conformidade com a Lei Geral de Proteção de
            Dados (LGPD, Lei nº 13.709/2018).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">2. Dados que coletamos</h2>
          <p className="mt-3">Podemos coletar, conforme o uso da plataforma:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <span className="text-ink">Conta e autenticação:</span> nome, e-mail, senha (armazenada
              de forma criptografada pelo provedor de autenticação) e, se você entrar com Google,
              identificadores e dados básicos do perfil fornecidos pelo Google.
            </li>
            <li>
              <span className="text-ink">Agendamentos:</span> nome, telefone, data e horário,
              serviço escolhido, profissional, estabelecimento e status da reserva.
            </li>
            <li>
              <span className="text-ink">Área profissional:</span> dados do estabelecimento (nome,
              endereço, telefone, link público), equipe, serviços, clientes cadastrados no painel,
              agenda, avaliações e informações necessárias à assinatura (incluindo CPF/CNPJ para
              faturamento).
            </li>
            <li>
              <span className="text-ink">Módulo PET:</span> dados dos tutores e dos pets (nome,
              porte, fotos e informações relacionadas ao atendimento).
            </li>
            <li>
              <span className="text-ink">Pagamentos da assinatura:</span> dados de cobrança
              processados pelo Asaas (Pix ou cartão). Não armazenamos o número completo do cartão
              em nossos servidores.
            </li>
            <li>
              <span className="text-ink">Localização aproximada:</span> se você permitir no
              navegador, usamos sua posição só para mostrar estabelecimentos próximos nas listas
              de FIND BARBEARIA e FIND PET. Não fazemos rastreamento contínuo e não gravamos essa
              posição em nossos servidores.
            </li>
            <li>
              <span className="text-ink">Dados técnicos:</span> logs de acesso, endereço IP,
              tipo de dispositivo/navegador e registros de erro, necessários para segurança e
              funcionamento do serviço.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">3. Para que usamos os dados</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Criar e gerenciar contas (cliente e profissional).</li>
            <li>Processar e exibir agendamentos, confirmações e avaliações.</li>
            <li>Mostrar estabelecimentos próximos, quando você permite a localização.</li>
            <li>Permitir que o estabelecimento gerencie clientes, pets, equipe e agenda.</li>
            <li>Cobrar e gerenciar a assinatura da área profissional.</li>
            <li>Prevenir fraudes, abusos e falhas de segurança.</li>
            <li>Cumprir obrigações legais e responder a solicitações de autoridades.</li>
            <li>Melhorar a estabilidade e a experiência de uso da plataforma.</li>
          </ul>
          <p className="mt-3">
            Bases legais típicas: execução de contrato (prestação do serviço), legítimo interesse
            (segurança e melhoria), consentimento quando aplicável (ex.: login com Google ou
            acesso à localização no navegador) e cumprimento de obrigação legal.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">4. Com quem compartilhamos</h2>
          <p className="mt-3">
            Não vendemos dados pessoais. Compartilhamos apenas o necessário para operar o FIND:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <span className="text-ink">Estabelecimentos:</span> ao agendar, seus dados de
              reserva (nome, telefone, horário, serviço etc.) ficam disponíveis ao negócio
              escolhido para execução do atendimento.
            </li>
            <li>
              <span className="text-ink">Supabase:</span> autenticação, banco de dados e
              infraestrutura de backend.
            </li>
            <li>
              <span className="text-ink">Vercel:</span> hospedagem e entrega do site.
            </li>
            <li>
              <span className="text-ink">Google:</span> quando você usa login com Google.
            </li>
            <li>
              <span className="text-ink">Geocodificação:</span> se você permitir a localização,
              o navegador consulta serviços de mapa para identificar sua cidade e a distância até
              os estabelecimentos. Não armazenamos sua posição.
            </li>
            <li>
              <span className="text-ink">Asaas:</span> processamento de pagamentos da assinatura
              profissional.
            </li>
          </ul>
          <p className="mt-3">
            Esses fornecedores tratam dados conforme suas próprias políticas e contratos de
            processamento, na medida necessária aos serviços contratados.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">5. Cookies e tecnologias semelhantes</h2>
          <p className="mt-3">
            Utilizamos armazenamento local do navegador e cookies/tecnologias semelhantes
            essenciais à sessão de login e ao funcionamento da aplicação. Não usamos cookies de
            publicidade de terceiros na experiência padrão do FIND.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">6. Retenção</h2>
          <p className="mt-3">
            Mantemos os dados enquanto sua conta estiver ativa e pelo tempo necessário para
            cumprir as finalidades desta Política, obrigações legais, resolução de disputas e
            segurança. Após exclusão de conta ou solicitação válida, eliminamos ou anonimizamos
            os dados, salvo quando a lei exigir retenção.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">7. Seus direitos (LGPD)</h2>
          <p className="mt-3">Você pode solicitar:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>confirmação do tratamento e acesso aos dados;</li>
            <li>correção de dados incompletos ou desatualizados;</li>
            <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li>portabilidade, quando aplicável;</li>
            <li>informação sobre compartilhamentos;</li>
            <li>revogação de consentimento, quando o tratamento se basear nele;</li>
            <li>oposição a tratamentos em hipóteses previstas na lei.</li>
          </ul>
          <p className="mt-3">
            Para exercer seus direitos (acesso, correção, exclusão e demais
            previstos na LGPD), envie um e-mail para{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=LGPD%20-%20FIND`}
              className="text-brass underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . Podemos solicitar confirmação de identidade antes de atender a
            solicitação.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">8. Segurança</h2>
          <p className="mt-3">
            Adotamos medidas técnicas e organizacionais razoáveis (incluindo controle de acesso e
            uso de provedores com criptografia em trânsito). Nenhum sistema é 100% seguro; em caso
            de incidente relevante, adotaremos as medidas cabíveis, inclusive comunicação quando
            exigido pela LGPD.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">9. Menores de idade</h2>
          <p className="mt-3">
            A plataforma não é direcionada a menores de 18 anos. Se você acredita que coletamos
            dados de um menor indevidamente, entre em contato para que possamos avaliar e remover
            quando apropriado.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">10. Alterações</h2>
          <p className="mt-3">
            Podemos atualizar esta Política periodicamente. A data no topo indica a versão
            vigente. Mudanças relevantes poderão ser comunicadas na própria plataforma ou por
            e-mail, quando fizer sentido.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wide text-ink">11. Contato</h2>
          <p className="mt-3">
            Dúvidas sobre privacidade ou esta Política:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-brass underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-12 text-sm text-ink-muted">
        <Link to="/" className="text-brass underline-offset-2 hover:underline">
          Voltar ao início
        </Link>
      </p>
    </article>
  )
}
