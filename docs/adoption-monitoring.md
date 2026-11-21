# Adoção e retenção no painel administrativo

Acesse **Interno → Lojas → estabelecimento → Adoção e retenção**. O acesso continua restrito ao administrador de plataforma existente. A API verifica a permissão atual em `auth.users.raw_app_meta_data`; usuários comuns não podem consultar a análise.

## Fontes e limites

- Histórico reconstruído: datas de criação dos registros ainda existentes. Sem reconstruir exclusões, sessões ou autores antigos. O profissional atribuído não é tratado como criador.
- Novas ações auditadas: gatilhos no servidor para agenda, clientes, pets, modelos e contratos de pacote, utilização de pacotes e financeiro. Gravam tipo de alteração, identificadores, usuário autenticado e papel naquele momento. Não gravam valores financeiros, contatos, nomes de clientes/pets, notas ou credenciais.
- Presença: painel operacional carregado na loja resolvida, aba visível, com foco e interação nos últimos cinco minutos. Envio no máximo por minuto por montagem. Sessões compartilhadas por usuário/loja com intervalo inferior a 30 minutos; presença não comprova uma operação. Dias de retorno usam datas de São Paulo, inclusive sessões que atravessam meia-noite. Não mede duração de trabalho.
- Última autenticação aparece separada: autenticação não equivale a uso operacional.
- Uma ação de negócio pode gerar alterações em várias entidades. A tela conta alterações persistidas; não soma esse total aos cadastros históricos como se fossem novas operações independentes.
- Hipóteses: ação auditada há até sete dias = sinal ativo; mais de sete dias com agenda aberta = possível cadastro antecipado/atividade reduzida; 14 dias sem ação com pelo menos 14 dias de cobertura e sem agenda aberta = possível abandono, a confirmar. Sem evidência suficiente, a tela informa observação insuficiente. A hipótese usa a observação atual, não reconstrói a situação histórica do estabelecimento.
- Não há marcador de recorrência na implementação existente. A tela informa essa ausência; não identifica padrões semanais como recorrência comprovada.

## Agenda

Filtros de período para atividade; referência independente para a agenda. “Futuros” inclui o dia de referência inteiro e todos os estados. “Futuros abertos” considera agendados, confirmados ou em atendimento, sem arquivados. Calendário com seleção do dia e lista paginada de 100 registros, com criação, atendimento, antecedência em dias civis de São Paulo, profissional, estado, marca histórica e autor auditado quando existente.

## Validação executada antes da publicação

- 167 testes automatizados em 25 arquivos; build com verificação TypeScript; lint sem erros (21 avisos existentes).
- Migração e testes SQL executados na mesma transação com ROLLBACK: criação/edição/cancelamento/conclusão, sete entidades auditadas, proprietário versus funcionário atribuído, sessões repetidas e intervalo de 30 minutos, isolamento entre lojas, recusa de leitura não administrativa, privilégios e ausência de contatos/notas no retorno.
- Leitura da StudioPet com referência em 20/11/2026: 412 agendamentos, 184 atribuídos à Evilim, 157 futuros e 107 passados com estado agendado; 138 registros arquivados incluídos no total. Nenhum registro real foi alterado pelos testes.
- Limite: o navegador disponível estava sem sessão administrativa. Verificação visual autenticada em desktop/celular depende de login do administrador; não foi declarada aprovada. Layout contém controles adaptáveis e tabelas com rolagem interna, mas isso não substitui o teste visual.

## Reexecutar testes de banco

Execute o arquivo `supabase/tests/adoption_monitoring.sql` entre `BEGIN` e `ROLLBACK`. Antes da migração persistida, inclua também o conteúdo da migração na transação. Os usuários e registros de teste são descartados integralmente pelo rollback; as verificações StudioPet são apenas leitura. As contagens de referência são um snapshot e deverão ser atualizadas se os dados operacionais mudarem.
