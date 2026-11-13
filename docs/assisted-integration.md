# Cadastro assistido pelo ChatGPT

Projeto Supabase: `znjgmtkmweujzitgwhos`. Produção: https://www.onefind.com.br.

## Autenticação e limites

A entrada usa a conexão Supabase autenticada do proprietário no ChatGPT. Não existe conta fictícia, senha salva ou chave administrativa no repositório. `submit_assisted_setup` só pode ser executada pela conexão administrativa (`postgres`/`supabase_admin`), nunca por anon, authenticated ou service_role na API pública. O ChatGPT mantém os poderes concedidos à conexão Supabase; a integração não reduz as permissões gerais desse conector.

O banco gera internamente um token aleatório por trabalho, guarda somente SHA-256 e chama a Edge Function `assisted-setup-worker` via pg_net. O token expira em dez minutos e só pode ser usado uma vez, em um trabalho. O worker valida o token antes de executar operações e reutiliza `executeAssisted`, extraído da função administrativa já existente. A service role fica apenas no ambiente interno da Edge Function. Não copiar credenciais do painel.

O worker só cria lojas novas. Não aceita IDs de pessoas ou serviços existentes nem campos administrativos arbitrários. O e-mail e o nome normalizados são únicos na fila; contas ou lojas já existentes são recusadas. Uma falha parcial fica registrada e bloqueia novas tentativas com o mesmo e-mail até revisão explícita. Não apagar registros para contornar essa proteção.

## Próximo estabelecimento

1. Pesquisar fontes oficiais e arquivos fornecidos, anotando fonte e incertezas. Não inventar preço, duração, equipe, disponibilidade ou regras comerciais.
2. Consultar `shops` e `auth.users` pelo nome/e-mail para verificar duplicações. Consultar também `private.assisted_jobs`.
3. Preparar um UUID estável e o payload abaixo. Preços e durações desconhecidos devem ser omitidos ou null. Uma equipe desconhecida fica como array vazio. Horários gerais conhecidos podem ser salvos em businessHours e hours_text sem inventar disponibilidade individual.
4. Chamar a função SQL pela conexão Supabase autorizada. A solicitação não envia e-mail ou WhatsApp.
5. Consultar o trabalho e a auditoria. `complete` só ocorre após conta, configuração, mídia, pendências e convite salvos. Conferir dados efetivos nas tabelas antes de entregar.
6. Entregar `result.actionLink` e a mensagem de WhatsApp. Não abrir o convite em um navegador para testá-lo: a página de ativação consome o token ao carregar. Testar o fluxo completo com uma conta QA separada. Para a cliente real, conferir o hash diretamente no Auth e manter `last_sign_in_at` e `activated_at` nulos.

```sql
select public.submit_assisted_setup(
  'UUID_ESTAVEL',
  '{
    "email":"responsavel@exemplo.com.br",
    "shopName":"Nome confirmado",
    "businessType":"grooming",
    "profile":{
      "address":"Endereço confirmado",
      "description":"Descrição confirmada",
      "phone":"11999999999",
      "hours_text":"Quinta-feira, 9h às 17h30. Demais dias a confirmar."
    },
    "services":[{"name":"Banho"}],
    "staff":[],
    "businessHours":[{"day_of_week":4,"start_time":"09:00","end_time":"17:30"}],
    "pendingNotes":["Confirmar os demais dias e a equipe."],
    "source":"https://site-oficial.exemplo"
  }'::jsonb
);
```

Serviço confirmado: `{"name":"Banho","price":80,"duration_minutes":45}`. Esses números são apenas exemplo de formato, nunca valores padrão. `staff` utiliza a estrutura existente de pessoas e `schedules` do painel, somente se confirmadas. `media` recebe objetos `{kind:"logo"|"banner",mime:"image/png"|"image/jpeg",base64:"..."}`. Preservar originais, usando só os cortes autorizados. Logo vai para `shops.logo_url`; banner/fotos vão para `shop_photos`, o campo de galeria já utilizado no perfil público.

```sql
select id,status,shop_id,result,activated_at from private.assisted_jobs
where email=lower(trim('responsavel@exemplo.com.br'));
select action,actor,created_at from private.assisted_audit
where job_id='UUID_ESTAVEL' order by id;
```

Os convites usam Supabase Auth recovery e a rota `/ativar?token_hash=...`, como o painel existente. A validade segue a configuração de OTP do Supabase. Gerar outro convite para conta existente exige consentimento específico e deve seguir o painel existente; a integração não renova nem altera clientes automaticamente.

## Trial e pendências

A criação reutiliza o trigger existente de Auth e o controle persistente de elegibilidade de trial. Para novas contas elegíveis criadas pela integração, o primeiro acesso pelo convite fixa os 30 dias completos a partir da ativação, uma única vez. Um e-mail sem elegibilidade não recebe novo trial. Clientes existentes não têm suas datas alteradas.

Serviços incompletos ficam em `assisted_service_drafts`, visíveis apenas à proprietária, fora do catálogo agendável. A tela pet mostra a lista e permite confirmar preço e duração usando uma transação que reutiliza `save_pet_service_duration`. Preço zero é válido somente se informado explicitamente. Horários gerais e outras pendências ficam em `assisted_shop_setup`. A agenda só pode ser disponibilizada após os profissionais e serviços reais serem configurados.

## Revogar e reativar

Pela conexão administrativa autorizada:

```sql
update private.assisted_integration set enabled=false; -- revogar novos envios e claims
-- update private.assisted_integration set enabled=true; -- reativar quando autorizado
```

A troca de estado é auditada. Um trabalho que já começou pode concluir; revisar sua auditoria antes de repetir qualquer ação. Para revogar também a conexão ampla do ChatGPT, desconectar o aplicativo Supabase nas configurações do ChatGPT.

## Validação

- `npm test`, `npm run build` (inclui TypeScript), `npm run lint`.
- Executar `supabase/tests/assisted_integration.sql` dentro de `BEGIN; ... ROLLBACK;`. Não executar sem rollback: contém fixtures e teste de revogação.
- O SQL cobre submissão normal, idempotência, duplicação, token inválido, replay, revogação, isolamento RLS, confirmação de serviço e trial de ativação sem renovação em segundo acesso.
- `ONEFIND_QA_ACTIVATION_LINK` deve apontar para uma conta descartável recém-preparada. Executar `npx playwright test tests/e2e/assisted-setup.spec.ts`. O teste consome o convite QA, define uma senha aleatória, confirma pendências, testa replay e login, e mede overflow em 320, 390, 768 e 1440px. Nunca usar o convite real da cliente.
- Auditoria de segurança do Supabase: avaliar achados novos da integração separadamente dos avisos anteriores do projeto.
