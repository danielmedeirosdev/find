# onefind — reformulação e evidências

Validação de 26/10/2026. Base anterior: `fdd9f329d0e36cf23ed1f09c727e702d976d7d95`.

## Reconstruído

- Navegação operacional compartilhada: menu lateral no desktop e acesso fixo no celular.
- Visão geral focada na agenda e no caixa do dia, substituindo doze consultas e indicadores redundantes.
- Agenda com horários visíveis no celular, ação principal por status, edição de data/hora/observações e inclusão de serviços durante o atendimento.
- Modal compartilhado com limite de altura, foco, Escape e restauração do foco.
- Busca de clientes e pets; edição de nome, WhatsApp e observações sem trocar a identidade dos registros.
- Fluxo financeiro baseado no orçamento salvo e nos lançamentos efetivos; pagamentos de pacotes separados do consumo de sessões.

## Removido

- `SetupChoice` e `ProfessionalOnboarding`, que mantinham a configuração guiada antiga.
- Navegação duplicada de abas e faixas decorativas no painel profissional.
- Sobrescritas globais de utilitários PET com `!important` que conflitavam com o tema.
- Recálculo do histórico pelo preço atual do catálogo e gravações parciais de agendamento/serviços.

## Corrigido

- Criação e edição atômicas no banco; conflito de duração verificado dentro da transação.
- Preço e duração por porte, descontos por dia, adicionais, transporte e total persistido.
- Finalização repetida sem duplicar recebimento ou consumo de pacote.
- Validação do valor no servidor; pacote limitado ao mesmo cliente, pet e estabelecimento.
- Pacote coberto não é cobrado novamente; recebimento opcional na associação registra uma entrada única por identificador da operação.
- Estado de pacote após alterar total/validade; sessões utilizadas preservadas pelo histórico.
- Relatórios e comissões usam recebimentos reais, sem alterar retroativamente preços combinados.
- Falhas de consulta não são apresentadas como saldo zero; falha no Google não impede login por senha.
- Comprovante usa o nome real da loja; previews Vercel não redirecionam para a versão antiga em produção.

## Verificação executada

- **89 testes de unidade aprovados**, incluindo centavos, orçamento salvo, transporte, pacote e caixa.
- **10 testes de navegador aprovados**: suíte principal com 9 casos e teste adicional de funcionário.
- Verificadas 11 áreas em **320, 375, 390, 430, 768 e 1440 px**, sem rolagem horizontal da página.
- Cadastro de uma loja fictícia pela interface; configuração, cliente, pet, três serviços, profissional, agendamento com vários serviços, confirmação, início, finalização, pacote, edição do pacote e relatório. Persistência consultada no Supabase.
- Segundo fluxo pela interface: adicionar serviço durante atendimento, conferir R$ 90, registrar pagamento, sair e entrar novamente, conferir persistência e apenas uma entrada financeira.
- Criar acesso de funcionário pela interface, entrar com esse acesso e verificar ausência de financeiro e isolamento dos dados.
- Campos inválidos e falha de rede simulada; nenhum cliente inválido salvo e nenhum saldo fictício exibido.
- Fixtures SQL com rollback verificam sobreposição, total adulterado, repetição e isolamento por RLS, inclusive com papel `authenticated`.
- TypeScript e build aprovados; lint com **zero erros e 21 avisos**.

Todos os dados criados para testes são fictícios e pertencem a lojas isoladas. Não foram alterados ou excluídos registros de estabelecimentos reais. Nenhuma assinatura paga foi iniciada.

## Limites e pendências

- Os 21 avisos de lint e o aviso de tamanho de bundle permanecem. O carregamento inicial foi reduzido com divisão de módulos, mas isso não constitui uma medição de Lighthouse.
- Testes de navegador executados em Chromium; Safari/iOS físico não foi executado.
- Avisos anteriores do Supabase continuam registrados: funções legadas sem `search_path` fixo, proteção contra senhas vazadas desativada e a projeção pública de horários. A projeção foi inspecionada e contém somente loja, profissional, data, horário e duração, sem nomes ou contatos de clientes.
- As funções novas ou alteradas preservam verificação de dono/profissional e revogam execução anônima nas operações administrativas. Nenhuma tabela teve RLS desativada.

## Reproduzir

`npm ci`, `npm test`, `npm run lint`, `npm run build` e `npx playwright test`.

Os testes ponta a ponta exigem `.env.local` com URL/chave pública e arquivos de credenciais/fixtures de uma conta QA isolada em `/tmp/onefind-qa-account.json` e `/tmp/onefind-qa-fixture.json`. Use `ONEFIND_QA_ACCOUNT` para outro caminho de credenciais. Nunca versione credenciais, sessões ou resultados de navegador com dados de usuários. O preview local usa 5173, origem já permitida pelas Edge Functions.

O commit e o deploy efetivamente promovidos devem ser conferidos nos metadados da Vercel e no relatório da conversa. A liberação exige build READY e verificação da versão remota.
