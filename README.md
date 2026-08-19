# ONEFIND

Plataforma SaaS multi-tenant para agendamento e gestão de negócios de serviços.

O projeto nasceu como **FIND**, focado em barbearias, e evoluiu para o **ONEFIND**, uma base mais ampla para segmentos como barbearias e pet shops. O produto reúne a experiência pública de reserva e as ferramentas operacionais do estabelecimento.

## Visão do produto

- Página pública de cada estabelecimento
- Agendamento online por serviço, profissional e horário
- Painel de gestão para operação diária
- Autenticação e login com Google
- Isolamento de dados por tenant
- Trial, assinatura e controle de acesso
- Avaliações pós-serviço
- Atualizações em tempo real

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS e React Router
- **Backend:** Supabase, PostgreSQL, Auth, Row Level Security e Edge Functions
- **Pagamentos:** Asaas
- **Testes:** Vitest
- **Deploy:** Vercel

## Arquitetura

```text
src/
  pages/public/     # Experiência de clientes e reservas
  pages/dashboard/  # Operação e gestão do estabelecimento
  lib/              # Integrações, regras de negócio e utilitários
supabase/
  migrations/       # Schema, políticas RLS e evolução do banco
  functions/        # Assinaturas, webhooks e rotinas de backend
```

A aplicação separa a experiência pública do painel administrativo. No backend, autenticação e políticas RLS ajudam a garantir que cada estabelecimento acesse somente seus próprios dados.

## Desenvolvimento local

### Requisitos

- Node.js
- npm
- Projeto Supabase configurado

### Instalação

```bash
npm install
cp .env.example .env
npm run dev
```

Variáveis do frontend:

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Secrets das Edge Functions:

```env
ASAAS_API_KEY=sua_chave
ASAAS_WEBHOOK_TOKEN=seu_token
CRON_SECRET=seu_token
HEAL_PET_SERVICES_TOKEN=seu_token
```

Execute as migrations de `supabase/migrations/` na ordem indicada pelo projeto. Para publicar as funções:

```bash
./scripts/deploy-functions.sh
```

O script publica as funções, mas não cria nem sobrescreve secrets remotos.

## Comandos

```bash
npm run dev        # ambiente de desenvolvimento
npm run build      # build de produção
npm run preview    # prévia do build
npm test           # suíte de testes
npm run test:watch # testes em modo contínuo
```

## Deploy

O frontend é publicado na Vercel. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` devem ser configuradas no ambiente do projeto. Edge Functions e secrets são administrados separadamente no Supabase.

## Status

Produto em evolução contínua, com foco em confiabilidade operacional, segurança multi-tenant e expansão para novos segmentos de serviços.

---

Desenvolvido por [Daniel Medeiros](https://github.com/danielmedeirosdev).
