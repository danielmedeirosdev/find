# FIND

Plataforma multi-tenant de agendamento online para barbearias.

## Stack

- **Frontend:** React + Vite + Tailwind CSS + React Router
- **Backend:** Supabase (Postgres, Auth, RLS, Edge Functions)
- **Pagamentos:** Asaas (sandbox)
- **Deploy:** Vercel

## Setup

### 1. Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute as migrations em `supabase/migrations/` (em ordem) no SQL Editor — para exclusão da barbearia rode `010`/`011`; para avaliações pós-serviço rode `012_reviews.sql`
3. Copie a URL e a anon key para `.env`

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Frontend (`.env`):
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Edge Functions (secrets no Supabase Dashboard → Edge Functions):
```
ASAAS_API_KEY=sua_chave_sandbox
ASAAS_WEBHOOK_TOKEN=token_secreto_webhook
```

### 3. Edge Functions

```bash
npx supabase functions deploy create-subscription
npx supabase functions deploy asaas-webhook --no-verify-jwt
```

Configure o webhook na Asaas apontando para:
```
https://xxx.supabase.co/functions/v1/asaas-webhook
```

### 4. Login com Google

1. No [Google Cloud Console](https://console.cloud.google.com/auth/clients/create), crie um OAuth Client ID do tipo **Web application**
2. Em **Authorized JavaScript origins**, adicione:
   - `http://localhost:5173` (dev)
   - a URL de produção (ex.: `https://seu-dominio.vercel.app`)
3. Em **Authorized redirect URIs**, adicione a callback do Supabase (em Authentication → Providers → Google), no formato:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
4. No Supabase Dashboard → **Authentication → Providers → Google**, ative o provider e cole Client ID + Client Secret
5. Em **Authentication → URL Configuration**, adicione nas Redirect URLs:
   - `http://localhost:5173/auth/callback`
   - `https://seu-dominio.vercel.app/auth/callback`

O app redireciona para `/auth/callback` e cria o perfil de cliente ou a barbearia conforme a tela de origem.

### 5. Desenvolvimento local

```bash
npm install
npm run dev
```

### 6. Deploy na Vercel

1. Conecte o repositório
2. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Deploy automático

## Estrutura

```
src/
  pages/public/     # Área do cliente (tom claro)
  pages/dashboard/  # Painel do barbeiro (tom escuro)
  lib/              # Supabase, booking logic, formatters
supabase/
  migrations/       # Schema SQL + RLS
  functions/        # create-subscription, asaas-webhook
```

## Assinatura

R$ 60/mês por barbearia via Asaas (Pix ou cartão). Status: `trial` → `active` → `blocked`.
