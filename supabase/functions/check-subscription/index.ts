import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFor } from "../_shared/cors.ts";
import { asaasFetch, getSubscription } from "../_shared/asaas-client.ts";
import { hasPaidCurrentCycle, type BillingPayment } from "../_shared/payment-entitlement.ts";

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...cors.headers, 'Content-Type': 'application/json' },
  });
  if (req.method === 'OPTIONS') return reply({}, cors.allowed ? 200 : 403);
  if (!cors.allowed) return reply({ error: 'Forbidden origin' }, 403);
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return reply({ error: 'Unauthorized' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error: 'Unauthorized' }, 401);
    const { shop_id } = await req.json();
    if (typeof shop_id !== 'string') return reply({ error: 'shop_id required' }, 400);
    const { data: shop, error } = await client.from('shops')
      .select('id, subscription_status, asaas_customer_id, asaas_subscription_id')
      .eq('id', shop_id).eq('owner_user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!shop) return reply({ error: 'Forbidden' }, 403);
    if (shop.subscription_status === 'active') return reply({ active: true });
    if (!shop.asaas_customer_id || !shop.asaas_subscription_id) return reply({ active: false });
    const apiKey = Deno.env.get('ASAAS_API_KEY');
    if (!apiKey) throw new Error('Billing provider unavailable');
    const subscription = await getSubscription(apiKey, shop.asaas_subscription_id);
    if (subscription?.customer !== shop.asaas_customer_id || subscription.status !== 'ACTIVE') {
      return reply({ active: false });
    }
    // Explicit recovery on return/manual request, never an unbounded polling loop.
    const result = await asaasFetch<{ data?: BillingPayment[]; hasMore?: boolean }>({
      path: `/payments?subscription=${encodeURIComponent(shop.asaas_subscription_id)}&customer=${encodeURIComponent(shop.asaas_customer_id)}&dueDate%5Bge%5D=${new Date(Date.now() - 32 * 86400000).toISOString().slice(0, 10)}&limit=100`,
      apiKey,
    });
    if (result.hasMore) throw new Error('Too many payments to reconcile safely');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (!hasPaidCurrentCycle(result.data ?? [], shop.asaas_customer_id, shop.asaas_subscription_id, today)) {
      return reply({ active: false });
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: updated, error: updateError } = await admin.from('shops')
      .update({ subscription_status: 'active' }).eq('id', shop.id)
      .eq('asaas_customer_id', shop.asaas_customer_id)
      .eq('asaas_subscription_id', shop.asaas_subscription_id)
      .eq('subscription_status', shop.subscription_status).select('id').maybeSingle();
    if (updateError || !updated) throw updateError ?? new Error('Subscription changed during verification');
    const referral = await admin.rpc('convert_shop_referral', { p_shop_id: shop.id });
    if (referral.error) console.error('Subscription referral conversion failed', referral.error.code);
    return reply({ active: true });
  } catch {
    console.error('Subscription verification failed');
    return reply({ error: 'Não foi possível conferir o pagamento agora. Tente novamente em instantes.' }, 502);
  }
});
