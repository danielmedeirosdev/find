#!/bin/bash
# Deploy das Edge Functions no Supabase
# Pré-requisito: npx supabase login

set -e
cd "$(dirname "$0")/.."

echo "→ Configurando secrets (edite se necessário)..."
npx supabase secrets set \
  ASAAS_API_KEY='COLOQUE_SUA_CHAVE' \
  ASAAS_WEBHOOK_TOKEN='COLOQUE_SEU_TOKEN' \
  ASAAS_API_URL='https://api.asaas.com/v3' \
  --project-ref znjgmtkmweujzitgwhos

echo "→ Deploy create-subscription..."
npx supabase functions deploy create-subscription --project-ref znjgmtkmweujzitgwhos

echo "→ Deploy asaas-webhook..."
npx supabase functions deploy asaas-webhook --project-ref znjgmtkmweujzitgwhos --no-verify-jwt

echo "✓ Pronto! Webhook URL:"
echo "  https://znjgmtkmweujzitgwhos.supabase.co/functions/v1/asaas-webhook"
