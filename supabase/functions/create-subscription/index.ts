import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  addDaysIso,
  nextDueFromComplimentary,
  pickActiveSubscription,
  utcTodayIso,
} from "./_shared/asaas-billing.ts";
import {
  asaasFetch,
  getSubscription,
  listCustomerSubscriptions,
  updateSubscriptionNextDueDate,
  type AsaasPayment,
  type AsaasSubscription,
} from "./_shared/asaas-client.ts";
import { corsFor } from "./_shared/cors.ts";

const SUBSCRIPTION_VALUE = 60;

function isAllowedPaymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "asaas.com" || url.hostname.endsWith(".asaas.com"));
  } catch {
    return false;
  }
}

async function persistSubscriptionLink(
  admin: SupabaseClient,
  shopId: string,
  subscriptionId: string,
  source: string,
) {
  const { data: shop } = await admin
    .from("shops")
    .select("asaas_subscription_id")
    .eq("id", shopId)
    .maybeSingle();

  if (shop?.asaas_subscription_id === subscriptionId) return;

  await admin
    .from("shops")
    .update({ asaas_subscription_id: subscriptionId })
    .eq("id", shopId);

  await admin.from("referral_events").insert({
    kind: "subscription_linked",
    shop_id: shopId,
    payload: {
      asaas_subscription_id: subscriptionId,
      previous_asaas_subscription_id: shop?.asaas_subscription_id ?? null,
      source,
    },
  });
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const corsHeaders = cors.headers;
  if (req.method === "OPTIONS") {
    return new Response(cors.allowed ? "ok" : "Forbidden", {
      status: cors.allowed ? 200 : 403,
      headers: corsHeaders,
    });
  }
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "Forbidden origin" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { shop_id, billing_type } = await req.json();
    if (!shop_id) {
      return new Response(JSON.stringify({ error: "shop_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const billingType = billing_type === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX";

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, name, cpf_cnpj, asaas_customer_id, complimentary_until")
      .eq("id", shop_id)
      .eq("owner_user_id", user.id)
      .single();

    if (shopError || !shop) {
      return new Response(JSON.stringify({ error: "Shop not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!shop.cpf_cnpj) {
      return new Response(JSON.stringify({ error: "CPF/CNPJ required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      return new Response(JSON.stringify({ error: "ASAAS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: billing } = await admin
      .from("shops")
      .select("asaas_customer_id, asaas_subscription_id, complimentary_until")
      .eq("id", shop_id)
      .single();

    let customerId = billing?.asaas_customer_id ?? shop.asaas_customer_id;

    if (!customerId) {
      const customer = await asaasFetch<{ id: string }>({
        path: "/customers",
        apiKey: asaasApiKey,
        method: "POST",
        body: {
          name: shop.name,
          cpfCnpj: shop.cpf_cnpj,
          email: user.email,
        },
      });
      customerId = customer.id;
      await admin
        .from("shops")
        .update({ asaas_customer_id: customerId })
        .eq("id", shop_id);
    }

    const tomorrow = addDaysIso(utcTodayIso(), 1);
    const dueDateStr = nextDueFromComplimentary(
      billing?.complimentary_until ?? shop.complimentary_until,
      tomorrow,
    );

    let subscription: AsaasSubscription | null = null;
    if (billing?.asaas_subscription_id) {
      const stored = await getSubscription(asaasApiKey, billing.asaas_subscription_id);
      if (stored?.status === "ACTIVE") subscription = stored;
    }
    if (!subscription && customerId) {
      const listed = await listCustomerSubscriptions(asaasApiKey, customerId);
      subscription = pickActiveSubscription(billing?.asaas_subscription_id ?? null, listed);
    }

    if (subscription) {
      await persistSubscriptionLink(admin, shop_id, subscription.id, "create-subscription-reuse");
      if (dueDateStr > (subscription.nextDueDate ?? "")) {
        subscription = await updateSubscriptionNextDueDate(
          asaasApiKey,
          subscription.id,
          dueDateStr,
        );
      }
    } else {
      subscription = await asaasFetch<AsaasSubscription>({
        path: "/subscriptions",
        apiKey: asaasApiKey,
        method: "POST",
        body: {
          customer: customerId,
          billingType,
          value: SUBSCRIPTION_VALUE,
          nextDueDate: dueDateStr,
          cycle: "MONTHLY",
          description: "FIND - Assinatura mensal da plataforma",
        },
      });
      await persistSubscriptionLink(admin, shop_id, subscription.id, "create-subscription");
    }

    let payment: AsaasPayment | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const payments = await asaasFetch<{ data?: AsaasPayment[] }>({
        path: `/payments?subscription=${subscription.id}&status=PENDING&limit=1`,
        apiKey: asaasApiKey,
      });
      payment = payments.data?.[0] ?? null;
      if (payment) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!payment) {
      return new Response(
        JSON.stringify({ alreadyActive: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let paymentLink =
      subscription.invoiceUrl ||
      subscription.paymentLink ||
      "";

    paymentLink =
      payment.invoiceUrl ||
      payment.bankSlipUrl ||
      payment.transactionReceiptUrl ||
      paymentLink;

    if (billingType === "PIX" && payment.id) {
      try {
        const pix = await asaasFetch<{ invoiceUrl?: string }>({
          path: `/payments/${payment.id}/pixQrCode`,
          apiKey: asaasApiKey,
        });
        paymentLink = payment.invoiceUrl || pix.invoiceUrl || paymentLink;
      } catch {
        paymentLink = payment.invoiceUrl || paymentLink;
      }
    }

    if (!paymentLink || !isAllowedPaymentUrl(paymentLink)) {
      return new Response(
        JSON.stringify({ error: "Valid payment link not found" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ paymentLink }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-subscription error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
