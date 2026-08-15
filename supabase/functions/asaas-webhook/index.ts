import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");

  if (!webhookToken || receivedToken !== webhookToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const event = body.event as string;
    const payment = body.payment;

    if (!payment?.customer) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("asaas_customer_id", payment.customer)
      .maybeSingle();

    if (!shop) {
      return new Response(JSON.stringify({ received: true, note: "shop not found" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      await supabase
        .from("shops")
        .update({ subscription_status: "active" })
        .eq("id", shop.id);
    } else if (event === "PAYMENT_OVERDUE") {
      await supabase
        .from("shops")
        .update({ subscription_status: "blocked" })
        .eq("id", shop.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
