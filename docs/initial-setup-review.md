# Configuração inicial — implementação em revisão

## Causa confirmada

`BusinessAuth` e o login Google resolvem a loja e redirecionam ao dashboard. Os tipos e eventos da escolha antiga continuam no repositório, mas nenhum componente em uso apresenta a escolha. O utilitário antigo baseado em onboarding_completed=false não pode ser reativado indiscriminadamente: também atingiria clientes antigos.

## Implementado nesta revisão (não publicado)

- Elegibilidade prospectiva em banco, sem backfill. Gatilho ignora contas antigas e criações pelo service_role da configuração administrativa. Proprietário lê/atualiza apenas a própria linha, com RLS; funcionário não recebe o guia.
- Escolha assistida ou por conta própria; progresso persistido, adiamento, dispensa, retomada e etapas puladas. Solicitação assistida pode ser consultada pelo administrador nos detalhes da loja.
- Janela sobreposta com largura máxima e altura limitada a 82dvh, rolagem interna, rodapé acessível e componentes existentes.
- Ordem por dependências: estabelecimento, equipe, horários por profissional, serviços, clientes/pets, pacotes. Nenhum profissional é criado automaticamente.
- Perfil e serviços aceitam modo compacto; exclui mídia/transportes avançados da configuração inicial. Exclusão da loja não aparece no modo compacto.
- Atalhos em agenda e pacotes abrem cadastros relacionados mantendo o formulário original montado; ao fechar, recarregam as listas. Modais aninhados deixam o teclado sob controle do diálogo superior.

## Validação executada

Migração e fixtures SQL executadas entre BEGIN/ROLLBACK: novo responsável elegível, usuário antigo excluído, criação administrativa excluída, progresso/adiamento/pulo persistidos e isolamento de leitura com SET LOCAL ROLE authenticated. Nenhuma migração desta revisão foi aplicada em produção.
Build com TypeScript e suíte automatizada foram executados. Esses resultados não comprovam fluxo completo no navegador.

## Pendências que impedem publicação

- Testar E2E e responsividade 320–430px e desktop, inclusive email/Google, ativação administrativa e criação/consumo reais de pacotes em ambiente isolado.
- Avançar ainda exige usar os botões Salvar/Adicionar dos componentes existentes. Falta conectar o salvamento ao Continuar e proteger rascunhos de etapas contra troca/fechamento sem salvar.
- Etapa de cliente/pet usa as telas existentes com seleção interna; precisa refino para um cadastro simplificado sequencial.
- Acesso e foco com modais aninhados precisam de teste visual, especialmente nos formulários de pets.
- Auditar os demais pontos de dependência (além dos atalhos implementados em agenda e pacotes) e validar renovação de disponibilidade após mudanças de horários/serviços.

Esta revisão é um trabalho em andamento. Não deve ser promovida à main antes de resolver as pendências e executar os fluxos solicitados.
