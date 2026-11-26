# Configuração inicial — revisão atual

## Causa
Cadastro e Google redirecionavam ao dashboard sem nenhum componente para a escolha inicial. Os tipos/eventos antigos permaneciam sem uso. Não foi reutilizada a regra antiga `onboarding_completed=false`, que atingiria contas existentes.

## Implementação
Elegibilidade prospectiva em banco; nenhuma conta antiga é incluída. Criações administrativas com service_role não recebem o guia. Funcionários não recebem o componente e RLS impede leitura/alteração de outros estabelecimentos.

Escolha assistida/manual, progresso, adiamento, dispensa, retomada, etapas puladas e solicitações assistidas consultáveis no administrativo. Janela sobreposta, largura máxima 36rem, altura máxima 82dvh, rolagem interna e rodapé fixo.

Ordem: estabelecimento, equipe, horários por profissional, serviços, cliente/pet, pacote opcional. Os formulários iniciais são compactos, sem fotos ou configurações avançadas. Horários e duração usam os componentes compartilhados do painel; serviços usam a mesma RPC de duração. As estruturas normais de lojas, profissionais, agenda, clientes, pets e pacotes continuam sendo as fontes oficiais.

Continuar salva a etapa e o progresso numa transação. Reenvio da mesma requisição usa recibo idempotente, evitando duplicações. Salvar e adicionar outro mantém a etapa e limpa o formulário após sucesso. Validação/erro mantém a etapa. Cliente+pet são salvos atomicamente; falha no pet não deixa cliente parcial.

Rascunhos são enviados ao banco após 350ms e sincronizados antes de voltar, pular ou fechar. Falha no envio mantém a janela aberta. O navegador avisa ao sair com alterações ainda pendentes. Não há garantia de persistência durante encerramento abrupto/offline antes da confirmação do banco. Rascunhos concluídos são removidos da linha de progresso.

Atalhos em agenda/pacotes mantêm o formulário original montado; recarregam listas ao fechar. Esses atalhos ainda reutilizam os formulários completos do painel.

## Validação executada
171 testes automatizados existentes; build/TypeScript e lint sem erros (21 avisos preexistentes).

SQL transacional com rollback: elegibilidade, conta antiga, criação administrativa, progresso/adiamento/pulo, RLS de leitura e isolamento. Segundo teste percorre as seis etapas, valida erro sem avanço, rascunho persistido, reenvio sem duplicação de serviço, cliente/pet atômicos, um único profissional, agendamento via RPC operacional, contratação e consumo de pacote, isolamento de escrita e conclusão com limpeza dos rascunhos.

## Interface verificada na preview

Com a conta de teste criada pelo usuário, o navegador mostrou a escolha inicial e percorreu as seis etapas. Foram verificados preenchimento prévio da loja, salvamento ao continuar, rascunho da equipe preservado ao configurar depois/atualizar/retomar, profissional único, horários, serviço com duração, cliente/pet, modelo de pacote, contratação e débito de uma sessão (4 → 3 restantes). Também foi criado agendamento com comprovante para 27/11/2026 às 10:00. A escolha assistida persistiu após atualizar; pular o último passo concluiu o guia. As repetições de cenário alteraram somente o progresso da loja de teste identificada pelo nome e ID.

O banco confirmou um profissional, um serviço e um agendamento nessa loja. Não foram enviados comprovantes nem mensagens. A sessão foi marcada como tráfego técnico.

## Ainda não comprovado

Cadastro real Google, consumo de convite e retomada após logout no navegador. Convites administrativos, contas antigas e isolamento foram verificados por SQL com usuários isolados e rollback, não por autenticação real. Layout desktop foi observado; as larguras 320–430px e Safari/iPhone não foram verificadas, pois o controle disponível não expôs redimensionamento e o zoom por teclado não alterou o viewport. Não declarar esses cenários aprovados.
