# PET: duração configurada pela dona — auditoria e entrega parcial

Base auditada: main do repositório danielmedeirosdev/find, antes desta branch.

## Estruturas existentes

- services.duration_minutes: duração base e fallback legado.
- service_size_rules: duração/preço por service_id e size; pertence ao tenant através de services.shop_id. Não criar coluna shop_id redundante.
- pets: nome, raça, porte e customer_id; shop_customers: tutor. PET_SIZES e constraints usam pequeno/medio/grande.
- PetBooking: getPetServicesDuration soma regras por serviço/pet; getAvailableSlots recebe a duração; create_public_booking grava bookings.duration_minutes e verifica interseção. Não há outro motor criado nesta mudança.
- service_custom_fields/service_custom_field_options: perguntas opcionais ou obrigatórias escolhidas pela dona; booking_custom_field_answers: respostas. Já suportam perguntas sobre pelagem/nós.
- PetAgenda: confirmação pela equipe existe. Não foi encontrado pedido sem horário/data no código auditado; não confundir onboarding guided com triagem manual.
- Fotos de pets usam shop-media/getPublicUrl. Upload privado de triagem não foi adicionado, conforme condição de segurança do pedido.

## Alteração mínima implementada na branch

- Campos novos começam vazios; duração única ou todos os portes devem ser preenchidos explicitamente. Sem multiplicadores e sem inserir exemplos.
- Reutiliza service_size_rules e PET_SIZES. Nenhuma tabela/coluna/policy criada, removida ou alterada.
- RPC save_pet_service_duration salva serviço e tempos atomicamente; SECURITY INVOKER mantém RLS e exige proprietária autenticada e loja PET. Edição valida service_id + shop_id.
- Ao escolher duração única, mantém linhas e preços por porte, atualizando somente seus tempos para o tempo escolhido. Configurações existentes não são migradas nem recalculadas.
- Por porte, todos os portes precisam ser informados; o primeiro valor informado serve também como duração base de compatibilidade. Todos os portes possuem regras explícitas, portanto não usam essa base no booking.
- Modo é inferido das durações existentes, evitando coluna adicional. Se todos os portes têm a mesma duração da base, a edição exibe duração única; o bloqueio de agenda é equivalente.
- Corrige edição de preço que antes criava regra com duração arbitrária de 60 minutos: agora usa a duração já cadastrada do serviço.
- Triagem permanece no mecanismo já existente; orientação PET esclarece o que configurar e quais dados não repetir.

## Validação realizada

Build + TypeScript: passaram. Vitest: 73 testes passaram (60 existentes e 13 de duração PET). ESLint: zero erros, 14 avisos em arquivos preexistentes fora da alteração. Diff sem problemas de whitespace.

| Caso pedido | Evidência / situação |
| --- | --- |
| 1. Serviço antigo único | Teste unitário passou |
| 2. Novo único | Validação de entrada e ausência de regras automáticas passaram; persistência real pendente |
| 3–4. Por porte e durações diferentes | Testes unitários e salvamento/transição por porte no banco real com rollback passaram |
| 5–6. Disponibilidade e sobreposição | Testes do motor passaram; concorrência real no banco NÃO validada |
| 7. Outro tenant | PASS no banco real: dona autorizada; outra dona bloqueada pela RPC e por UPDATE direto; anon sem EXECUTE |
| 8. Reutilização do pet | Fluxo existente identificado e preservado; E2E pendente |
| 9. Mobile | PENDENTE: navegador local falhou ao iniciar (EGL/Vulkan); navegador remoto não acessou localhost. Não afirmar aprovação mobile. |
| 10–12. Barbearia, financeiro, autenticação/onboarding | Código desses fluxos não alterado; suites existentes passaram; E2E pendente |

## Bloqueio para produção

Atualização 2026-09-15: o projeto estava hibernado. Uma requisição REST somente leitura retornou HTTP 200 e o banco voltou a responder. Schema e RLS reais foram conferidos.

A migration foi executada apenas dentro de uma transação de teste no banco real, usando tenants e valores já existentes. Passaram: salvamento pela dona, transição única/por porte, preservação de preços, rejeição de dados incompletos, bloqueio da RPC para outra dona, UPDATE direto de services e service_size_rules bloqueado para outra dona e ausência de EXECUTE para anon. Tudo foi revertido por ROLLBACK; uma consulta posterior confirmou que a função de teste não ficou instalada. Não foram criados clientes, pets, serviços ou agendamentos de exemplo.

Script reproduzível: supabase/tests/pet_duration_real_tenant_rollback.sql. Executar na mesma transação da migration de teste, conforme comentário do arquivo. Não substitui testes de concorrência de reservas.

Teste mobile preparado para 320px e 390px, mas não executado: navegador agent-browser falhou ao iniciar; navegador remoto bloqueou localhost; Chromium local falhou na inicialização gráfica. Nenhum resultado mobile aprovado.

O usuário autorizou explicitamente enviar a branch e abrir PR de rascunho sem o teste mobile. Mobile permanece não verificado; a dispensa permite o envio para revisão. Não há autorização de merge/deploy nesta entrega. Nenhuma migration instalada permanentemente.

O frontend depende da migration 20260915180343_pet_service_duration_configuration.sql. Antes do deploy, aplicar a migration; testes E2E completos permanecem pendentes. O teste mobile foi dispensado pelo usuário para abertura do PR. A função de salvamento e o isolamento de escrita já passaram no teste transacional real. A RPC é a única mudança de banco e não modifica registros ao ser instalada.

Riscos preexistentes a verificar ao recuperar acesso: create_public_booking recebe duração do cliente; checagem de sobreposição por consulta não comprova exclusão concorrente; configurações de duração/preço têm leitura pública necessária ao booking (não afirmar que são secretas entre contas). Endurecimento exige confronto com funções/policies reais antes de alterações.

Também existe função legada heal-pet-services que cria serviços padrão; não foi executada nem alterada nesta branch. Investigar uso efetivo antes de retirar comportamento de onboarding fora deste escopo.

## Arquivos

- src/components/PetDurationFields.tsx
- src/lib/pet.ts
- src/lib/__tests__/petDuration.test.ts
- src/pages/dashboard/professional/pet/PetServices.tsx
- supabase/migrations/20260915180343_pet_service_duration_configuration.sql
- docs/pet-duration-audit.md

- supabase/tests/pet_duration_real_tenant_rollback.sql (novo nesta validação)
