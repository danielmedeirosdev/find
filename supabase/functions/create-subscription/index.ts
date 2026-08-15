import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") ?? "https://api.asaas.com/v3";
const SUBSCRIPTION_VALUE = 60;

const ALLOWED_ORIGINS = new Set([
  "https://www.onefind.com.br",
  "https://onefind.com.br",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    allowed: !origin || ALLOWED_ORIGINS.has(origin),
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
        ? origin
        : "https://www.onefind.com.br",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  };
}

function isAllowedPaymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "asaas.com" || url.hostname.endsWith(".asaas.com"));
  } catch {
    return false;
  }
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
      { global: { headers: { Authorization: authHeader } } }
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

    const billingType =
      billing_type === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX";

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("*")
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

    const asaasHeaders = {
      "Content-Type": "application/json",
      access_token: asaasApiKey,
    };

    let customerId = shop.asaas_customer_id;

    if (!customerId) {
      const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: asaasHeaders,
        body: JSON.stringify({
          name: shop.name,
          cpfCnpj: shop.cpf_cnpj,
          email: user.email,
        }),
      });

      if (!customerRes.ok) {
        console.error("Asaas customer creation failed", customerRes.status);
        return new Response(JSON.stringify({ error: "Failed to create Asaas customer" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customer = await customerRes.json();
      customerId = customer.id;

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await adminClient
        .from("shops")
        .update({ asaas_customer_id: customerId })
        .eq("id", shop_id);
    }

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const dueDateStr = nextDueDate.toISOString().slice(0, 10);

    const subscriptionRes = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value: SUBSCRIPTION_VALUE,
        nextDueDate: dueDateStr,
        cycle: "MONTHLY",
        description: "FIND - Assinatura mensal da plataforma",
      }),
    });

    if (!subscriptionRes.ok) {
      console.error("Asaas subscription creation failed", subscriptionRes.status);
      return new Response(JSON.stringify({ error: "Failed to create subscription" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscription = await subscriptionRes.json();

    // A cobrança pode demorar alguns segundos para aparecer
    let payment: Record<string, string> | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const paymentsRes = await fetch(
        `${ASAAS_API_URL}/payments?subscription=${subscription.id}&status=PENDING&limit=1`,
        { headers: asaasHeaders }
      );
      if (paymentsRes.ok) {
        const payments = await paymentsRes.json();
        payment = payments.data?.[0] ?? null;
        if (payment) break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    let paymentLink =
      subscription.invoiceUrl ||
      subscription.paymentLink ||
      "";

    if (payment) {
      paymentLink =
        payment.invoiceUrl ||
        payment.bankSlipUrl ||
        payment.transactionReceiptUrl ||
        paymentLink;

      if (billingType === "PIX" && payment.id) {
        const pixRes = await fetch(
          `${ASAAS_API_URL}/payments/${payment.id}/pixQrCode`,
          { headers: asaasHeaders }
        );
        if (pixRes.ok) {
          const pix = await pixRes.json();
          // invoiceUrl abre a fatura com QR Pix; se não houver, usa link direto
          paymentLink = payment.invoiceUrl || pix.invoiceUrl || paymentLink;
        }
      }
    }

    if (!paymentLink || !isAllowedPaymentUrl(paymentLink)) {
      return new Response(
        JSON.stringify({
          error: "Valid payment link not found",
          subscriptionId: subscription.id,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        subscriptionId: subscription.id,
        paymentLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
