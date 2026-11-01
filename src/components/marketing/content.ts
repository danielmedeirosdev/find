import type { AppIconName } from "../AppIcon";

export const signupPath = "/painel?segment=pet&modo=cadastro";
export type FeatureId =
  | "agenda"
  | "clientes-e-pets"
  | "servicos"
  | "pacotes"
  | "financeiro"
  | "equipe";
export type Feature = {
  id: FeatureId;
  icon: AppIconName;
  label: string;
  title: string;
  description: string;
  points: [string, string][];
  question: string;
  answer: string;
};
export const features: Feature[] = [
  {
    id: "agenda",
    icon: "agenda",
    label: "Agenda",
    title: "Seu dia, organizado.",
    description:
      "Encontre os atendimentos do dia, escolha o profissional e reserve o tempo que cada pet precisa.",
    points: [
      [
        "Tudo no dia certo",
        "Consulte a agenda por data e registre o atendimento direto no painel.",
      ],
      [
        "O tempo que faz sentido",
        "Ajuste o tempo reservado e inclua serviços extras que cabem no mesmo horário.",
      ],
      [
        "Seu link de agendamento",
        "Compartilhe a página do estabelecimento para o tutor consultar serviços e horários disponíveis.",
      ],
    ],
    question: "Preciso deixar o cliente agendar sozinho?",
    answer:
      "Não. Você também pode registrar os atendimentos pelo painel. Quando precisar avaliar o pet, combine os detalhes com o tutor antes de confirmar o horário.",
  },
  {
    id: "clientes-e-pets",
    icon: "paw",
    label: "Clientes e pets",
    title: "Cada pet tem sua história.",
    description:
      "Contato do tutor, dados do pet e observações juntos, para consultar antes do próximo atendimento.",
    points: [
      [
        "Tutor e pet conectados",
        "Encontre os pets vinculados ao cliente e seus contatos no mesmo lugar.",
      ],
      [
        "Cuidados que ficam registrados",
        "Guarde observações sobre o pet para consultar durante a rotina.",
      ],
      [
        "Histórico à mão",
        "Acompanhe os atendimentos anteriores sem procurar em conversas antigas.",
      ],
    ],
    question: "Um cliente pode ter mais de um pet?",
    answer:
      "Sim. Os pets ficam vinculados ao tutor, cada um com seu próprio cadastro e histórico.",
  },
  {
    id: "servicos",
    icon: "scissors",
    label: "Serviços",
    title: "Seu jeito de atender.",
    description:
      "Configure preços e durações. Combine os serviços do atendimento sem perder o controle da agenda.",
    points: [
      [
        "Preços por porte",
        "Configure valores e duração de acordo com o porte do pet.",
      ],
      [
        "Extras no mesmo atendimento",
        "Adicione serviços durante a finalização e confira o valor antes de concluir.",
      ],
      [
        "Tempo reservado independente",
        "Um horário de 60 minutos pode incluir extras sem aumentar automaticamente o período ocupado.",
      ],
    ],
    question: "Adicionar um serviço sempre aumenta o horário?",
    answer:
      "Não. O tempo reservado pode ser mantido quando o extra cabe no mesmo período. Se precisar de mais tempo, ajuste a reserva; alterações que ocupam a agenda passam pela verificação de conflitos.",
  },
  {
    id: "pacotes",
    icon: "package",
    label: "Pacotes",
    title: "Cada sessão, no controle.",
    description:
      "Venda pacotes, acompanhe o uso das sessões e consulte o que ainda falta receber.",
    points: [
      [
        "Sessões usadas e restantes",
        "Consulte o saldo e o histórico de utilização do pacote.",
      ],
      [
        "Uso no atendimento",
        "Ao concluir um atendimento vinculado ao pacote, a sessão é descontada.",
      ],
      [
        "Extras separados",
        "Serviços adicionais não cobertos pelo pacote podem ser cobrados no atendimento.",
      ],
    ],
    question: "Usar uma sessão gera outra cobrança do pacote?",
    answer:
      "Não. A sessão coberta utiliza o pacote. Serviços extras não incluídos são cobrados à parte, quando adicionados ao atendimento.",
  },
  {
    id: "financeiro",
    icon: "wallet",
    label: "Financeiro",
    title: "Recebido é recebido. Pendente é pendente.",
    description:
      "Conclua o atendimento mesmo quando o cliente vai pagar depois. Registre o recebimento quando ele acontecer.",
    points: [
      [
        "Concluir sem receber",
        "Finalize o serviço e deixe o valor em aberto, sem lançar uma entrada de caixa.",
      ],
      [
        "Pagamento posterior ou parcial",
        "Registre o valor recebido e a forma de pagamento. O saldo restante continua pendente.",
      ],
      [
        "Veja os números separados",
        "Acompanhe entradas, despesas e valores a receber sem confundir atendimento concluído com dinheiro recebido.",
      ],
    ],
    question: "Posso receber só uma parte do valor?",
    answer:
      "Sim. Registre o pagamento parcial e acompanhe o restante em pagamentos pendentes até quitar o valor.",
  },
  {
    id: "equipe",
    icon: "users",
    label: "Equipe",
    title: "Cada pessoa com seu acesso.",
    description:
      "Organize os profissionais e os atendimentos com acessos separados para proprietário e funcionários.",
    points: [
      [
        "Agenda por profissional",
        "Vincule os atendimentos a quem vai realizar o serviço.",
      ],
      [
        "Equipe participa da rotina",
        "Funcionários autorizados podem registrar agendamentos e trabalhar nos atendimentos.",
      ],
      [
        "Financeiro com o proprietário",
        "O acesso da equipe respeita as permissões do sistema, sem liberar o painel financeiro do dono.",
      ],
    ],
    question: "Preciso compartilhar minha senha com a equipe?",
    answer:
      "Não. Os profissionais usam seus próprios acessos, com permissões específicas para a rotina de atendimento.",
  },
];
