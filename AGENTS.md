# AGENTS.md

## Cursor Cloud specific instructions

FIND / ONEFIND is a multi-tenant online-booking platform for barbershops and pet
shops. Frontend is React 19 + Vite + TypeScript + Tailwind (`src/`); backend is
Supabase (Postgres + Auth + RLS + Deno Edge Functions in `supabase/`).

### Commands (see `package.json`)

- Dev server: `npm run dev` (Vite on `http://localhost:5173`).
- Build + typecheck: `npm run build` (runs `tsc -b` then `vite build`). There is
  **no separate lint or test script** and no ESLint config, so `npm run build`
  is the type/compile check to run before committing.
- The update script already runs `npm install`; you normally only need
  `npm run dev`.

### Environment / Supabase (non-obvious)

- The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`
  (gitignored; template in `.env.example`). Without them the app still boots but
  shows a "Supabase não configurado" banner and all data/auth actions no-op
  (`src/lib/supabase.ts` → `isSupabaseConfigured`).
- The documented dev flow points `.env` at a **hosted** Supabase project. No
  local seed and no credentials are committed.

### Running a local Supabase backend (gotchas)

Local backend needs Docker (not in the base image) plus the Supabase CLI
(`npx supabase`). `supabase start` auto-applies `supabase/migrations/`, but a
from-scratch replay does **not** work as-is:

1. Two migrations share the version prefix `010` (`010_delete_own_shop.sql` and
   `010_find_pet_core.sql`) → CLI fails with a duplicate-key error on
   `schema_migrations`.
2. The `public_booking_slots` view is (re)defined with different column sets
   across parallel migration branches, so `CREATE OR REPLACE VIEW` at
   `014_booking_slots_and_unique.sql` errors ("cannot drop columns from view")
   until `020_fix_public_booking_slots.sql` reconciles it.

These are pre-existing migration-ordering issues (do not "fix" them for the
hosted flow, which applies SQL manually/in authored order). To get a working
local DB without editing the repo: start a clean stack with the migrations dir
temporarily emptied, then apply each `supabase/migrations/*.sql` in sorted order
via `psql`, running `DROP VIEW IF EXISTS public.public_booking_slots CASCADE;`
before any file that redefines that view. Local defaults auto-confirm email, so
`supabase.auth.signUp` returns a usable session immediately.

### App flow notes

- A barber signup (`role: 'barber'` metadata) auto-provisions a `shops` row via
  the `handle_new_user` trigger (`002_signup_trigger.sql`) and the client seeds
  default services (`src/lib/auth.ts`). This is the quickest way to exercise
  core functionality end-to-end.
- Edge Functions under `supabase/functions/` (Asaas payments, reminders, etc.)
  are Deno and are not required for basic frontend/dashboard development.
