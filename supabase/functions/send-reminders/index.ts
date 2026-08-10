import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Lembretes de agendamento (cron).
 * - Cria notificações para o profissional
 * - Tenta WhatsApp só se WHATSAPP_PROVIDER_URL + token estiverem configurados
 * - Sem provedor: não finge envio; retorna skipped
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, shop_id, client_name, client_phone, time, pets(name), shops(name)")
      .eq("date", date)
      .in("status", ["scheduled", "confirmed"]);

    if (error) throw error;

    const providerUrl = Deno.env.get("WHATSAPP_PROVIDER_URL");
    const providerToken = Deno.env.get("WHATSAPP_PROVIDER_TOKEN");
    const whatsappConfigured = Boolean(providerUrl && providerToken);

    let notified = 0;
    let whatsappSent = 0;
    let whatsappSkipped = 0;

    for (const b of bookings || []) {
      const petName = (b.pets as { name?: string } | null)?.name;
      const shopName = (b.shops as { name?: string } | null)?.name || "FIND";
      const title = "Lembrete de amanhã";
      const body = `${petName || b.client_name} · ${b.time}`;

      await supabase.rpc("notify_shop_owner", {
        p_shop_id: b.shop_id,
        p_kind: "booking_reminder",
        p_title: title,
        p_body: body,
        p_booking_id: b.id,
      });
      notified += 1;

      if (!whatsappConfigured) {
        whatsappSkipped += 1;
        continue;
      }

      const phone = String(b.client_phone || "").replace(/\D/g, "");
      if (phone.length < 10) {
        whatsappSkipped += 1;
        continue;
      }

      const res = await fetch(providerUrl!, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phone,
          message: `Lembrete ${shopName}: ${petName || b.client_name} amanhã às ${b.time}.`,
          kind: "booking_reminder",
          booking_id: b.id,
          shop_id: b.shop_id,
        }),
      });

      if (res.ok) whatsappSent += 1;
      else whatsappSkipped += 1;
    }

    return new Response(
      JSON.stringify({
        date,
        bookings: bookings?.length ?? 0,
        owner_notifications: notified,
        whatsapp_sent: whatsappSent,
        whatsapp_skipped: whatsappSkipped,
        whatsapp_configured: whatsappConfigured,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-reminders error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
