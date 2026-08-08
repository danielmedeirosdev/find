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

O app usa Google Identity Services (popup) + `signInWithIdToken` do Supabase.  
No Google Cloud você só precisa de **Authorized JavaScript origins** (sem caminho `/`):

1. No [Google Cloud Console](https://console.cloud.google.com/auth/clients), abra o cliente Web
2. Em **Authorized JavaScript origins**, adicione só o domínio:
   - `https://find-onefind.vercel.app`
   - `http://localhost:5173` (dev)
3. No Supabase → **Authentication → Providers → Google**, ative e cole Client ID + Client Secret
4. (Opcional) `VITE_GOOGLE_CLIENT_ID` no `.env` / Vercel — já há fallback no código

Não é necessário colar URL com `/auth/...` no Google para este fluxo.

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
