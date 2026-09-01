import type { AppIconName } from '../components/AppIcon'

export interface ReleaseNote {
  title: string
  description: string
  icon: AppIconName
}

export interface ProductRelease {
  id: string
  date: string
  label: string
  title: string
  summary: string
  notes: ReleaseNote[]
}

export const PRODUCT_RELEASES: ProductRelease[] = [
  {
    id: 'pet-operacao-completa',
    date: '2026-09-01',
    label: 'Grande atualização',
    title: 'ONEFIND PET mais completo e profissional',
    summary: 'Uma evolução ampla do cadastro à rotina diária, mantendo um único painel para todos os tipos de negócio PET.',
    notes: [
      { title: 'Painel PET unificado', description: 'Banho e tosa, clínica veterinária, pet shop, creche e hospedagem, dog walker, adestramento e negócios completos usam a mesma experiência.', icon: 'paw' },
      { title: 'Configuração guiada', description: 'Novo passo a passo de entrada com escolha do ramo, dados essenciais, serviços, equipe e horários.', icon: 'sparkles' },
      { title: 'Agenda e dias de folga', description: 'Horários e ausências da equipe ficaram mais claros, com aviso público quando o estabelecimento está fechado no dia.', icon: 'agenda' },
      { title: 'Taxi Pet', description: 'Busca do animal com endereço, instruções e taxa incluída no valor final do agendamento.', icon: 'car' },
      { title: 'Preço flexível por serviço', description: 'Perguntas personalizadas e descontos por dia agora participam do cálculo real do preço e dos registros financeiros.', icon: 'tag' },
      { title: 'Gestão essencial', description: 'Melhorias em retorno e recorrência, equipe, financeiro, clínica básica e estoque básico conforme o ramo escolhido.', icon: 'chart' },
      { title: 'Identidade PET renovada', description: 'Visual em grafite, off-white e tons de âmbar, mel e caramelo, com leitura e hierarquia aprimoradas.', icon: 'sparkles' },
      { title: 'Conexão mais compreensível', description: 'Falhas de rede deixaram de exibir mensagens técnicas em inglês e agora orientam o usuário com clareza.', icon: 'refresh' },
    ],
  },
  {
    id: 'confiabilidade-e-acesso',
    date: '2026-08-30',
    label: 'Polimento',
    title: 'Carregamento e suporte mais consistentes',
    summary: 'A experiência inicial ficou mais estável e os canais de contato foram revisados.',
    notes: [
      { title: 'Abertura sem tela desformatada', description: 'Correção do carregamento inicial para evitar que estilos apareçam atrasados.', icon: 'sparkles' },
      { title: 'Contato atualizado', description: 'E-mail de suporte alinhado nas páginas de dúvidas e privacidade.', icon: 'check' },
    ],
  },
  {
    id: 'entrada-guiada',
    date: '2026-08-20',
    label: 'Onboarding',
    title: 'Primeiro acesso guiado para empresas',
    summary: 'A abertura do negócio passou a explicar cada etapa e a levar o proprietário até o painel pronto para uso.',
    notes: [
      { title: 'Cadastro passo a passo', description: 'Fluxo ampliado para dados do estabelecimento, equipe, serviços e horários.', icon: 'settings' },
      { title: 'Segmento preservado', description: 'O ramo escolhido continua correto durante o cadastro e nos acessos seguintes.', icon: 'store' },
      { title: 'Agenda restaurada', description: 'Ações importantes do atendimento voltaram a funcionar de forma consistente.', icon: 'agenda' },
      { title: 'Dados públicos confiáveis', description: 'Informações do estabelecimento voltaram a aparecer corretamente para clientes.', icon: 'shield' },
    ],
  },
  {
    id: 'equipe-cobranca-seguranca',
    date: '2026-08-18',
    label: 'Estrutura',
    title: 'Equipe, cobrança e segurança fortalecidas',
    summary: 'Melhorias de base para o crescimento do ONEFIND sem abrir mão da separação entre empresas.',
    notes: [
      { title: 'Painel da equipe separado', description: 'Profissionais e proprietários passaram a ter acessos compatíveis com suas responsabilidades.', icon: 'users' },
      { title: 'Cobrança e assinatura reforçadas', description: 'Fluxos de assinatura, recuperação de conta e proteção contra horários sobrepostos foram fortalecidos.', icon: 'wallet' },
      { title: 'Indique e ganhe', description: 'Programa de indicação conectado à assinatura para os segmentos barbearia e PET.', icon: 'heart' },
      { title: 'Proteção entre empresas', description: 'Regras de acesso e criação de equipe foram revisadas para manter os dados de cada estabelecimento isolados.', icon: 'shield' },
    ],
  },
  {
    id: 'agenda-notificacoes',
    date: '2026-08-17',
    label: 'Experiência',
    title: 'Agenda e notificações mais profissionais',
    summary: 'A rotina de atendimento ficou mais clara, inclusive em telas menores.',
    notes: [
      { title: 'Navegação da agenda', description: 'Ajustes de organização e usabilidade para acompanhar os atendimentos.', icon: 'agenda' },
      { title: 'Notificações aprimoradas', description: 'Avisos e permanência da sessão ficaram mais previsíveis.', icon: 'bell' },
      { title: 'Identidade correta por ramo', description: 'Elementos visuais da barbearia deixaram de aparecer indevidamente no painel PET.', icon: 'check' },
    ],
  },
  {
    id: 'agendamento-publico',
    date: '2026-08-16',
    label: 'Clientes',
    title: 'Agendamento público mais agradável',
    summary: 'A jornada usada pelo cliente ganhou acabamento, clareza e melhor adaptação ao celular.',
    notes: [
      { title: 'Fluxo de reserva refinado', description: 'Escolha de serviço, profissional e horário com apresentação mais clara.', icon: 'clock' },
      { title: 'Experiência responsiva', description: 'Ajustes para tornar a reserva mais confortável em diferentes tamanhos de tela.', icon: 'sparkles' },
    ],
  },
]

export function formatReleaseDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}
