#!/usr/bin/env bash
# Deploy das Edge Functions sem alterar secrets remotos.
# Pré-requisito: npx supabase login

set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-znjgmtkmweujzitgwhos}"

echo "→ Deploy create-subscription..."
npx supabase functions deploy create-subscription --project-ref "$PROJECT_REF"

echo "→ Deploy asaas-webhook..."
npx supabase functions deploy asaas-webhook --project-ref "$PROJECT_REF" --no-verify-jwt

echo "→ Deploy expire-trials..."
npx supabase functions deploy expire-trials --project-ref "$PROJECT_REF" --no-verify-jwt

echo "→ Deploy send-reminders..."
npx supabase functions deploy send-reminders --project-ref "$PROJECT_REF" --no-verify-jwt

echo "→ Deploy heal-pet-services..."
npx supabase functions deploy heal-pet-services --project-ref "$PROJECT_REF" --no-verify-jwt

echo "→ Deploy provision-staff-access..."
npx supabase functions deploy provision-staff-access --project-ref "$PROJECT_REF"

echo "✓ Pronto! Webhook URL:"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/asaas-webhook"
echo "✓ Secrets remotos não foram alterados."
